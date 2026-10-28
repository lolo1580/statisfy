import "server-only";

import { clearCache } from "../cache";
import { prisma } from "../db";

export type RecountResult = { reset: number; evaluated: number };

/**
 * Recalcule l'indicateur `counted` de **toutes** les écoutes selon le seuil
 * `ratio` : remet tout à `true` (couvre les durées inconnues), puis repasse en
 * `false` les écoutes dont la piste a une durée connue et qui sont sous le
 * seuil.
 *
 * Utilisé par le réglage admin et par le script de rattrapage
 * (`pnpm db:backfill-counted`).
 */
export async function recountPlays(ratio: number): Promise<RecountResult> {
  const reset = await prisma.play.updateMany({ data: { counted: true } });
  const evaluated = await prisma.$executeRaw`
    UPDATE "Play"
    SET "counted" = ("Play"."msPlayed" >= "Track"."durationMs" * ${ratio}::double precision)
    FROM "Track"
    WHERE "Play"."trackId" = "Track"."id"
      AND "Track"."durationMs" IS NOT NULL
      AND "Track"."durationMs" > 0
  `;
  // Toutes les écoutes sont concernées : le cache de stats entier est obsolète.
  clearCache();

  return { reset: reset.count, evaluated };
}
