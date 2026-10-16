/**
 * Rattrapage : recalcule l'indicateur `counted` (seuil d'écoute) pour les
 * écoutes déjà en base, selon le seuil configuré (défaut 3/4).
 *
 *   pnpm db:backfill-counted
 *
 * Idempotent : relancer le script donne le même résultat. Les écoutes dont la
 * durée de piste est inconnue restent comptées (cf. src/lib/play-counting.ts).
 */
import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { getMinListenRatio } from '../src/lib/settings'
import { recountPlays } from '../src/lib/sync/recount'

async function main() {
  const ratio = await getMinListenRatio()
  const { reset, evaluated } = await recountPlays(ratio)
  console.log(
    `${reset} écoute(s) réinitialisée(s), ${evaluated} évaluée(s) contre la durée (seuil ${ratio}).`,
  )
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
