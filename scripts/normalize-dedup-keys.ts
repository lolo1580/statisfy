/**
 * Rattrapage : normalise les clés de déduplication à la seconde.
 *
 *   pnpm db:normalize-dedup
 *
 * Les écoute synchronisées (millisecondes) et importées (secondes) d'une même
 * piste produisaient deux clés différentes, donc deux lignes. Ce script :
 *   1. supprime les doublons qui ne diffèrent que par les millisecondes ;
 *   2. réécrit les clés restantes au format normalisé.
 *
 * Idempotent : relancer le script ne fait plus rien.
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  // 1) Doublons « même seconde » : on garde la ligne créée en premier.
  const deleted = await prisma.$executeRaw`
    DELETE FROM "Play" p
    USING "Play" q
    WHERE p.id <> q.id
      AND p."userId" = q."userId"
      AND regexp_replace(p."dedupKey", '\\.\\d{3}Z$', 'Z')
        = regexp_replace(q."dedupKey", '\\.\\d{3}Z$', 'Z')
      AND (
        p."createdAt" > q."createdAt"
        OR (p."createdAt" = q."createdAt" AND p.id > q.id)
      )
  `;
  // 2) Normalisation des clés restantes.
  const normalized = await prisma.$executeRaw`
    UPDATE "Play"
    SET "dedupKey" = regexp_replace("dedupKey", '\\.\\d{3}Z$', 'Z')
    WHERE "dedupKey" <> regexp_replace("dedupKey", '\\.\\d{3}Z$', 'Z')
  `;
  console.log(
    `${deleted} doublon(s) supprimé(s), ${normalized} clé(s) normalisée(s).`,
  );
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
