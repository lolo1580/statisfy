import "server-only";

import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../db";
import type { DailyStat } from "./timeline";

/**
 * Agrégats quotidiens matérialisés :
 * - `UserDailyStat` : toutes les écoutes d'un utilisateur, par jour local ;
 * - `UserArtistDailyStat` : par artiste et jour local ;
 * - `UserTrackDailyStat` : par titre et jour local.
 *
 * Deux modes de maintenance :
 * - **incrémental** (`refreshUserStatsForDays`) après une sync/import : seuls
 *   les jours touchés sont recalculés ;
 * - **complet** (`refreshUserStats`) après un changement de fuseau, un recalcul
 *   du seuil ou un backfill.
 *
 * Les lectures retombent sur les écoutes brutes si les tables sont vides
 * (base fraîchement migrée mais pas encore backfillée).
 */

/** Nombre de jours recalculés par transaction (borne la taille des requêtes). */
const DAYS_PER_CHUNK = 90;

/** Fuseau valide ou UTC (une timezone corrompue ne doit pas casser l'agrégat). */
function safeTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

async function userTimeZone(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  return user ? safeTimeZone(user.timezone || "UTC") : null;
}

/** Expression SQL du jour local pour un fuseau donné. */
function localDay(timeZone: string): Prisma.Sql {
  return Prisma.sql`to_char(
    ("playedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone},
    'YYYY-MM-DD'
  )`;
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Recalcule entièrement les trois tables pour un utilisateur.
 * Utilisé au backfill, après un changement de fuseau ou un recalcul du seuil.
 */
export async function refreshUserStats(userId: string): Promise<void> {
  const timeZone = await userTimeZone(userId);
  if (!timeZone) return;

  await prisma.$transaction([
    prisma.userDailyStat.deleteMany({ where: { userId } }),
    prisma.userArtistDailyStat.deleteMany({ where: { userId } }),
    prisma.userTrackDailyStat.deleteMany({ where: { userId } }),
    prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "UserDailyStat" ("userId", "day", "plays", "msPlayed")
        SELECT ${userId},
               ${localDay(timeZone)},
               COUNT(*)::int,
               COALESCE(SUM("msPlayed"), 0)::bigint
        FROM "Play"
        WHERE "userId" = ${userId} AND "counted" = true
        GROUP BY 2
      `,
    ),
    prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "UserArtistDailyStat"
          ("userId", "artistId", "day", "plays", "msPlayed")
        SELECT ${userId},
               "artistId",
               ${localDay(timeZone)},
               COUNT(*)::int,
               COALESCE(SUM("msPlayed"), 0)::bigint
        FROM "Play"
        WHERE "userId" = ${userId} AND "counted" = true
        GROUP BY 2, 3
      `,
    ),
    prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "UserTrackDailyStat"
          ("userId", "trackId", "day", "plays", "msPlayed")
        SELECT ${userId},
               "trackId",
               ${localDay(timeZone)},
               COUNT(*)::int,
               COALESCE(SUM("msPlayed"), 0)::bigint
        FROM "Play"
        WHERE "userId" = ${userId} AND "counted" = true
        GROUP BY 2, 3
      `,
    ),
  ]);
}

/** Recalcule une liste de jours locaux pour un fuseau déjà résolu. */
async function refreshDays(
  userId: string,
  timeZone: string,
  days: readonly string[],
): Promise<void> {
  const unique = [...new Set(days)].sort();
  if (unique.length === 0) return;

  for (const chunk of chunks(unique, DAYS_PER_CHUNK)) {
    await prisma.$transaction([
      prisma.userDailyStat.deleteMany({
        where: { userId, day: { in: chunk } },
      }),
      prisma.userArtistDailyStat.deleteMany({
        where: { userId, day: { in: chunk } },
      }),
      prisma.userTrackDailyStat.deleteMany({
        where: { userId, day: { in: chunk } },
      }),
      prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO "UserDailyStat" ("userId", "day", "plays", "msPlayed")
          SELECT ${userId},
                 ${localDay(timeZone)},
                 COUNT(*)::int,
                 COALESCE(SUM("msPlayed"), 0)::bigint
          FROM "Play"
          WHERE "userId" = ${userId}
            AND "counted" = true
            AND ${localDay(timeZone)} = ANY(${chunk}::text[])
          GROUP BY 2
        `,
      ),
      prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO "UserArtistDailyStat"
            ("userId", "artistId", "day", "plays", "msPlayed")
          SELECT ${userId},
                 "artistId",
                 ${localDay(timeZone)},
                 COUNT(*)::int,
                 COALESCE(SUM("msPlayed"), 0)::bigint
          FROM "Play"
          WHERE "userId" = ${userId}
            AND "counted" = true
            AND ${localDay(timeZone)} = ANY(${chunk}::text[])
          GROUP BY 2, 3
        `,
      ),
      prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO "UserTrackDailyStat"
            ("userId", "trackId", "day", "plays", "msPlayed")
          SELECT ${userId},
                 "trackId",
                 ${localDay(timeZone)},
                 COUNT(*)::int,
                 COALESCE(SUM("msPlayed"), 0)::bigint
          FROM "Play"
          WHERE "userId" = ${userId}
            AND "counted" = true
            AND ${localDay(timeZone)} = ANY(${chunk}::text[])
          GROUP BY 2, 3
        `,
      ),
    ]);
  }
}

/**
 * Recalcule uniquement les jours touchés par une sync/import.
 * `days` doit contenir des jours locaux `YYYY-MM-DD`.
 */
export async function refreshUserStatsForDays(
  userId: string,
  days: readonly string[],
): Promise<void> {
  const timeZone = await userTimeZone(userId);
  if (!timeZone) return;
  await refreshDays(userId, timeZone, days);
}

/**
 * Recalcule les jours locaux couverts par une plage d'écoutes `[from, to)`.
 * Utilisé après un ingest : une seule requête identifie les jours concernés,
 * puis seuls ceux-ci sont reconstruits.
 */
export async function refreshUserStatsForRange(
  userId: string,
  from: Date,
  to: Date,
): Promise<void> {
  const timeZone = await userTimeZone(userId);
  if (!timeZone) return;

  const rows = await prisma.$queryRaw<Array<{ day: string }>>(
    Prisma.sql`
      SELECT DISTINCT ${localDay(timeZone)} AS day
      FROM "Play"
      WHERE "userId" = ${userId}
        AND "counted" = true
        AND "playedAt" >= ${from}
        AND "playedAt" < ${to}
    `,
  );

  await refreshDays(
    userId,
    timeZone,
    rows.map((row) => row.day),
  );
}

/** Recalcule tous les comptes (backfill, changement global de seuil). */
export async function refreshAllUserStats(): Promise<number> {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const user of users) {
    await refreshUserStats(user.id);
  }
  return users.length;
}

function toDailyStats(
  rows: Array<{ day: string; plays: number; msPlayed: bigint }>,
): DailyStat[] {
  return rows.map((row) => ({
    day: row.day,
    plays: row.plays,
    msPlayed: Number(row.msPlayed),
  }));
}

/** Série quotidienne globale d'un utilisateur. */
export async function getStoredDailyStats(
  userId: string,
): Promise<DailyStat[]> {
  const rows = await prisma.userDailyStat.findMany({
    where: { userId },
    orderBy: { day: "asc" },
  });
  return toDailyStats(rows);
}

/** Série quotidienne d'un artiste pour un utilisateur. */
export async function getStoredArtistDailyStats(
  userId: string,
  artistId: string,
): Promise<DailyStat[]> {
  const rows = await prisma.userArtistDailyStat.findMany({
    where: { userId, artistId },
    orderBy: { day: "asc" },
  });
  return toDailyStats(rows);
}

/** Série quotidienne d'un titre pour un utilisateur. */
export async function getStoredTrackDailyStats(
  userId: string,
  trackId: string,
): Promise<DailyStat[]> {
  const rows = await prisma.userTrackDailyStat.findMany({
    where: { userId, trackId },
    orderBy: { day: "asc" },
  });
  return toDailyStats(rows);
}
