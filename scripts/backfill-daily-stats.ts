/**
 * Rattrapage : reconstruit les agrégats quotidiens (`UserDailyStat`) pour tous
 * les comptes. Utile après une mise à jour, ou si la table a été vidée.
 *
 *   pnpm db:backfill-daily-stats
 *
 * Idempotent : chaque compte est entièrement recalculé dans une transaction.
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { refreshAllUserStats } from "../src/lib/stats/daily-store";

async function main() {
  const started = Date.now();
  const count = await refreshAllUserStats();
  console.log(
    `Agrégats quotidiens reconstruits pour ${count} compte(s) en ${
      Date.now() - started
    } ms.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
