/**
 * Rattrapage : réinjecte les métadonnées de comportement (appareil, saut, mode
 * aléatoire, hors ligne, raison de fin…) sur les écoutes **déjà** en base, à
 * partir d'un export Spotify « Extended streaming history ».
 *
 *   pnpm db:backfill-play-metadata ~/Téléchargements/my_spotify_data.zip --email vous@exemple.com
 *
 * L'import normal est dédupliqué : les écoutes déjà présentes ne sont pas
 * réinsérées, donc les colonnes ajoutées récemment (`platform`, `skipped`, …)
 * resteraient vides. Ce script les met à jour en s'appuyant sur `dedupKey`.
 * Idempotent : une colonne déjà renseignée n'est écrasée que par une valeur non
 * nulle.
 *
 * Options :
 *   --email <mail>  compte Statisfy cible (sinon le plus ancien compte)
 */
import "dotenv/config";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/db";
import { buildDedupKey } from "../src/lib/sync/dedup";
import { parseSpotifyHistoryFiles } from "../src/lib/sources/importer";
import type { RawPlay } from "../src/lib/sources/types";

/** Taille des lots d'UPDATE : borne la taille de la requête SQL générée. */
const CHUNK = 200;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/** Développe les entrées en liste de fichiers `.zip` / `.json`. */
function collectPaths(inputs: string[]): string[] {
  const out: string[] = [];
  for (const input of inputs) {
    try {
      const stat = statSync(input);
      if (stat.isDirectory()) {
        for (const entry of readdirSync(input)) {
          if (/\.(json|zip)$/i.test(entry)) out.push(join(input, entry));
        }
      } else {
        out.push(input);
      }
    } catch {
      console.warn(`⚠️  Introuvable, ignoré : ${input}`);
    }
  }
  return out;
}

/** Une écoute porte-t-elle au moins une métadonnée exploitable ? */
function hasMetadata(play: RawPlay): boolean {
  return (
    play.platform !== undefined ||
    play.country !== undefined ||
    play.skipped !== undefined ||
    play.shuffle !== undefined ||
    play.offline !== undefined ||
    play.incognito !== undefined ||
    play.reasonStart !== undefined ||
    play.reasonEnd !== undefined
  );
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const inputs: string[] = [];
  for (let i = 0; i < rawArgs.length; i += 1) {
    const value = rawArgs[i];
    if (value === "--email") {
      i += 1;
      continue;
    }
    if (value.startsWith("--")) continue;
    inputs.push(value);
  }

  if (inputs.length === 0) {
    throw new Error(
      "Indiquez au moins un fichier .zip ou .json (ou un dossier qui les contient).",
    );
  }

  const email = arg("email") ?? process.env.IMPORT_EMAIL;
  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) {
    throw new Error(
      "Aucun utilisateur Statisfy cible. Créez un compte ou passez --email.",
    );
  }

  const paths = collectPaths(inputs);
  if (paths.length === 0) throw new Error("Aucun fichier .zip / .json trouvé.");

  const files = paths.map((path) => ({
    name: basename(path),
    data: readFileSync(path),
  }));
  const { plays, files: parsed } = parseSpotifyHistoryFiles(files);

  // Une seule entrée par clé de déduplication (la dernière l'emporte).
  const byKey = new Map<string, RawPlay>();
  for (const play of plays) {
    if (!hasMetadata(play)) continue;
    byKey.set(buildDedupKey(play), play);
  }

  console.log(
    `Spotify : ${parsed} fichier(s) d'historique, ${plays.length} écoute(s) lue(s), ` +
      `${byKey.size} avec métadonnées.`,
  );

  const entries = [...byKey.entries()];
  let updated = 0;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK);
    const values = chunk.map(
      ([key, play]) => Prisma.sql`(
        ${key}::text,
        ${play.platform ?? null}::text,
        ${play.country ?? null}::text,
        ${play.skipped ?? null}::boolean,
        ${play.shuffle ?? null}::boolean,
        ${play.offline ?? null}::boolean,
        ${play.incognito ?? null}::boolean,
        ${play.reasonStart ?? null}::text,
        ${play.reasonEnd ?? null}::text
      )`,
    );
    updated += await prisma.$executeRaw(
      Prisma.sql`
        UPDATE "Play" AS p SET
          platform = COALESCE(m.platform, p.platform),
          country = COALESCE(m.country, p.country),
          skipped = COALESCE(m.skipped, p.skipped),
          shuffle = COALESCE(m.shuffle, p.shuffle),
          offline = COALESCE(m.offline, p.offline),
          incognito = COALESCE(m.incognito, p.incognito),
          "reasonStart" = COALESCE(m."reasonStart", p."reasonStart"),
          "reasonEnd" = COALESCE(m."reasonEnd", p."reasonEnd")
        FROM (VALUES ${Prisma.join(values)}) AS m(
          "dedupKey", platform, country, skipped, shuffle, offline, incognito,
          "reasonStart", "reasonEnd"
        )
        WHERE p."userId" = ${user.id} AND p."dedupKey" = m."dedupKey"
      `,
    );
    console.log(
      `… ${Math.min(i + CHUNK, entries.length)}/${entries.length} traité(s)`,
    );
  }

  console.log(
    `Rattrapage terminé pour ${user.email} : ${updated} écoute(s) mise(s) à jour.`,
  );
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
