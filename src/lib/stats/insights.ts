import "server-only";

import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../db";
import { dayKey, getTimezoneOffsetMs } from "../format";
import { computeRecords, type ListeningRecords } from "../records";
import { getTimeBuckets, type DailyStat } from "./timeline";
import { DAY_MS, bucketDate, parseGenres, type StatsRange } from "./shared";
import type { TopArtist } from "./rankings";

// --- Redécouvertes, records & habitudes ------------------------------------

export type RediscoveredArtist = TopArtist & { lastPlayedAt: Date };

/**
 * Artistes « oubliés » : beaucoup écoutés par le passé mais plus depuis
 * `afterDays`. Toujours calculé sur **tout** l'historique (indépendant de la
 * période sélectionnée), car c'est un conseil de réécoute, pas une stat de période.
 */
export async function getRediscoveries(
  userId: string,
  options: { afterDays?: number; minPlays?: number; limit?: number } = {},
): Promise<RediscoveredArtist[]> {
  const { afterDays = 60, minPlays = 5, limit = 5 } = options;
  const cutoff = new Date(Date.now() - afterDays * DAY_MS);

  const groups = await prisma.play.groupBy({
    by: ["artistId"],
    where: { userId, counted: true },
    _count: { _all: true },
    _sum: { msPlayed: true },
    _max: { playedAt: true },
  });

  const forgotten = groups
    .filter(
      (row) =>
        row._max.playedAt !== null &&
        row._max.playedAt < cutoff &&
        row._count._all >= minPlays,
    )
    .sort((a, b) => (b._sum.msPlayed ?? 0) - (a._sum.msPlayed ?? 0))
    .slice(0, limit);

  if (forgotten.length === 0) return [];

  const artists = await prisma.artist.findMany({
    where: { id: { in: forgotten.map((row) => row.artistId) } },
  });
  const byId = new Map(artists.map((artist) => [artist.id, artist]));

  return forgotten.flatMap((row) => {
    const artist = byId.get(row.artistId);
    if (!artist || !row._max.playedAt) return [];
    return [
      {
        id: artist.id,
        name: artist.name,
        plays: row._count._all,
        msPlayed: row._sum.msPlayed ?? 0,
        imageUrl: artist.imageUrl,
        genres: parseGenres(artist.genres),
        lastPlayedAt: row._max.playedAt,
      },
    ];
  });
}

/**
 * Jours actifs pour les records : l'agrégation est faite **dans le fuseau
 * local** par PostgreSQL (`AT TIME ZONE`), ce qui évite de relire toutes les
 * tranches de 15 minutes de l'historique complet puis de les reventiler en JS
 * (cf. `getDailyStats`). On ne renvoie que les jours ayant au moins une écoute :
 * `computeRecords` n'a pas besoin des jours vides.
 */
async function getActiveDays(
  userId: string,
  timeZone: string,
): Promise<DailyStat[]> {
  const rows = await prisma.$queryRaw<
    Array<{ day: string; plays: number; msPlayed: bigint }>
  >(
    Prisma.sql`
      SELECT to_char(
               ("playedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone},
               'YYYY-MM-DD'
             ) AS day,
             COUNT(*)::int AS plays,
             COALESCE(SUM("msPlayed"), 0)::bigint AS "msPlayed"
      FROM "Play"
      WHERE "userId" = ${userId} AND "counted" = true
      GROUP BY day
      ORDER BY day
    `,
  );
  return rows.map((row) => ({
    day: row.day,
    plays: Number(row.plays),
    msPlayed: Number(row.msPlayed),
  }));
}

/** Records sur tout l'historique : séries, jours actifs, jour le plus intense. */
export async function getRecords(
  userId: string,
  timeZone: string,
): Promise<ListeningRecords> {
  const daily = await getActiveDays(userId, timeZone);
  return computeRecords(daily, dayKey(new Date(), timeZone));
}

export type WeeklyHourHeatmap = { grid: number[][]; max: number };

/**
 * Répartition des écoutes par **jour de la semaine × heure locale** (lundi = 0),
 * pour la période demandée. Une seule lecture des tranches de 15 min.
 */
export async function getWeeklyHourStats(
  userId: string,
  timeZone: string,
  range: StatsRange,
): Promise<WeeklyHourHeatmap> {
  const buckets = await getTimeBuckets(userId, range);
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));

  for (const bucket of buckets) {
    const date = bucketDate(bucket.bucket);
    const local = new Date(
      date.getTime() + getTimezoneOffsetMs(timeZone, date),
    );
    const dow = (local.getUTCDay() + 6) % 7;
    grid[dow][local.getUTCHours()] += bucket.plays;
  }

  let max = 0;
  for (const row of grid) {
    for (const value of row) if (value > max) max = value;
  }
  return { grid, max };
}

export type ListeningBehavior = {
  /** Nombre d'écoutes porteuses des métadonnées (export étendu). */
  sample: number;
  skippedRate: number | null;
  shuffleRate: number | null;
  offlineRate: number | null;
  platforms: { platform: string; plays: number }[];
};

/**
 * Habitudes d'écoute issues de l'export étendu Spotify (appareil, saut, aléatoire,
 * hors ligne). Ne renvoie que des valeurs présentes : `null` si la colonne est
 * absente (échantillon nul).
 */
export async function getListeningBehavior(
  userId: string,
): Promise<ListeningBehavior> {
  const where: Prisma.PlayWhereInput = {
    userId,
    counted: true,
    platform: { not: null },
  };
  const [sample, skipped, shuffled, offline, platforms] = await Promise.all([
    prisma.play.count({ where }),
    prisma.play.count({ where: { ...where, skipped: true } }),
    prisma.play.count({ where: { ...where, shuffle: true } }),
    prisma.play.count({ where: { ...where, offline: true } }),
    prisma.play.groupBy({
      by: ["platform"],
      where,
      _count: { _all: true },
    }),
  ]);

  const rate = (value: number) => (sample > 0 ? value / sample : null);

  return {
    sample,
    skippedRate: rate(skipped),
    shuffleRate: rate(shuffled),
    offlineRate: rate(offline),
    platforms: platforms
      .map((row) => ({ platform: row.platform ?? "—", plays: row._count._all }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 5),
  };
}
