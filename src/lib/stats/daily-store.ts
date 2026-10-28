import "server-only";

import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../db";
import type { DailyStat } from "./timeline";

/**
 * Agrégats quotidiens matérialisés (`UserDailyStat`).
 *
 * La table stocke, pour chaque utilisateur et chaque **jour local**, le nombre
 * d'écoutes comptées et le temps d'écoute. Elle est reconstruite après chaque
 * sync/import (`refreshUserDailyStats`) et pour les bases existantes via
 * `pnpm db:backfill-daily-stats`.
 *
 * Les lectures retombent sur les écoutes brutes si la table est vide (base
 * fraîchement migrée mais pas encore backfillée) : le déploiement reste sûr.
 */

/** Fuseau valide ou UTC (une timezone corrompue ne doit pas casser l'agrégat). */
function safeTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

/**
 * Recalcule les agrégats quotidiens d'un utilisateur.
 *
 * Une seule requête SQL fait le regroupement dans le fuseau local ; le
 * `deleteMany` + `INSERT` sont dans une transaction pour éviter une lecture
 * partielle pendant le remplacement.
 */
export async function refreshUserDailyStats(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  if (!user) return;

  const timeZone = safeTimeZone(user.timezone || "UTC");

  await prisma.$transaction([
    prisma.userDailyStat.deleteMany({ where: { userId } }),
    prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "UserDailyStat" ("userId", "day", "plays", "msPlayed")
        SELECT ${userId},
               to_char(
                 ("playedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone},
                 'YYYY-MM-DD'
               ),
               COUNT(*)::int,
               COALESCE(SUM("msPlayed"), 0)::bigint
        FROM "Play"
        WHERE "userId" = ${userId} AND "counted" = true
        GROUP BY 2
      `,
    ),
  ]);
}

/** Recalcule les agrégats de tous les comptes (backfill, changement global). */
export async function refreshAllUserDailyStats(): Promise<number> {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const user of users) {
    await refreshUserDailyStats(user.id);
  }
  return users.length;
}

/** Lit les agrégats quotidiens d'un utilisateur, triés par jour. */
export async function getStoredDailyStats(
  userId: string,
): Promise<DailyStat[]> {
  const rows = await prisma.userDailyStat.findMany({
    where: { userId },
    orderBy: { day: "asc" },
  });
  return rows.map((row) => ({
    day: row.day,
    plays: row.plays,
    msPlayed: Number(row.msPlayed),
  }));
}
