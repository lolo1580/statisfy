/**
 * Import d'un export de données Spotify (« Extended streaming history »).
 *
 *   pnpm import:spotify-history ~/Téléchargements/my_spotify_data.zip --email vous@exemple.com
 *
 * Options :
 *   --email <mail>  compte Statisfy cible (sinon le plus ancien compte)
 *   --limit <n>     ne traiter que les n premières écoutes (test)
 *
 * Accepte un ou plusieurs fichiers `.zip` / `.json`, ou un dossier qui les
 * contient. Pratique pour les gros historiques (plusieurs années), là où
 * l'upload navigateur devient long.
 */
import "dotenv/config";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { prisma } from "../src/lib/db";
import { ingestPlays } from "../src/lib/sync/ingest";
import { parseSpotifyHistoryFiles } from "../src/lib/sources/importer";

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

async function main() {
  const raw = process.argv.slice(2);
  const inputs: string[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const value = raw[i];
    if (value === "--email" || value === "--limit") {
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
  const limit = Number(arg("limit")) || 0;

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
  const selected = limit > 0 ? plays.slice(0, limit) : plays;

  console.log(
    `Spotify : ${parsed} fichier(s) d'historique, ${plays.length} écoute(s) lue(s).`,
  );

  const result = await ingestPlays(user.id, selected);
  console.log(
    `Import terminé pour ${user.email} : ${result.inserted} écoute(s) insérée(s) ` +
      `sur ${result.total} lue(s).`,
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
