/**
 * Rattrapage : marque comme « import » les écoutes importées qui étaient
 * historiquement enregistrées avec `source = "spotify"` (comme les synchros).
 *
 *   pnpm db:backfill-source
 *
 * Idempotent : ne touche que les lignes encore en `spotify` dont le contexte
 * indique une importation (`import` ou `your_spotify`).
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const result = await prisma.play.updateMany({
    where: { source: "spotify", context: { in: ["import", "your_spotify"] } },
    data: { source: "import" },
  });
  console.log(`${result.count} écoute(s) marquée(s) « import ».`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
