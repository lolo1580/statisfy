import "server-only";

import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../db";
import { dayKey, getTimezoneOffsetMs } from "../format";
import { computeRecords, type ListeningRecords } from "../records";
import { getStoredDailyStats } from "./daily-store";
import { getTimeBuckets, type DailyStat } from "./timeline";
import { DAY_MS, bucketDate, parseGenres, type StatsRange } from "./shared";
import type { TopArtist } from "./rankings";
import { pickDiverseRediscoveries, rankRediscoveries } from "../rediscoveries";

// --- Redécouvertes, records & habitudes ------------------------------------

export type RediscoveredArtist = TopArtist & {
  lastPlayedAt: Date;
  /** Ancienneté de la dernière écoute, en jours. */
  daysSince: number;
};

/**
 * Artistes « oubliés » : suffisamment écoutés par le passé, plus depuis
 * `afterDays`, et **classés par un score** qui combine affection, silence,
 * longévité et régularité (cf. `src/lib/rediscoveries.ts`).
 *
 * Toujours calculé sur **tout** l'historique (indépendant de la période
 * sélectionnée), car c'est un conseil de réécoute, pas une stat de période.
 * Le filtrage lourd (seuil d'écoutes + ancienneté) est fait en SQL ; seuls les
 * meilleurs candidats sont chargés pour appliquer la diversité des genres.
 */
export async function getRediscoveries(
  userId: string,
  options: { afterDays?: number; minPlays?: number; limit?: number } = {},
): Promise<RediscoveredArtist[]> {
  const { afterDays = 60, minPlays = 5, limit = 5 } = options;
  const now = new Date();
  const cutoff = new Date(now.getTime() - afterDays * DAY_MS);

  const rows = await prisma.$queryRaw<
    Array<{
      artistId: string;
      plays: number;
      msPlayed: bigint;
      lastPlayedAt: Date;
      firstPlayedAt: Date;
      activeMonths: number;
    }>
  >(
    Prisma.sql`
      SELECT "artistId",
             COUNT(*)::int AS plays,
             COALESCE(SUM("msPlayed"), 0)::bigint AS "msPlayed",
             MAX("playedAt") AS "lastPlayedAt",
             MIN("playedAt") AS "firstPlayedAt",
             COUNT(DISTINCT date_trunc('month', "playedAt"))::int AS "activeMonths"
      FROM "Play"
      WHERE "userId" = ${userId} AND "counted" = true
      GROUP BY "artistId"
      HAVING MAX("playedAt") < ${cutoff} AND COUNT(*) >= ${minPlays}
    `,
  );

  if (rows.length === 0) return [];

  const ranked = rankRediscoveries(
    rows.map((row) => ({
      artistId: row.artistId,
      plays: Number(row.plays),
      msPlayed: Number(row.msPlayed),
      lastPlayedAt: row.lastPlayedAt,
      firstPlayedAt: row.firstPlayedAt,
      activeMonths: Number(row.activeMonths),
    })),
    now,
  );

  // On ne charge que les meilleurs candidats : assez pour appliquer la
  // diversité de genres sans rapatrier toute la bibliothèque.
  const shortlist = ranked.slice(0, Math.max(limit * 10, 20));
  const artists = await prisma.artist.findMany({
    where: { id: { in: shortlist.map((entry) => entry.item.artistId) } },
  });
  const byId = new Map(artists.map((artist) => [artist.id, artist]));

  const candidates = shortlist.flatMap((entry) => {
    const artist = byId.get(entry.item.artistId);
    if (!artist) return [];
    return [
      {
        item: {
          id: artist.id,
          name: artist.name,
          plays: entry.item.plays,
          msPlayed: entry.item.msPlayed,
          imageUrl: artist.imageUrl,
          genres: parseGenres(artist.genres),
          lastPlayedAt: entry.item.lastPlayedAt,
          daysSince: entry.daysSince,
        },
        score: entry.score,
        daysSince: entry.daysSince,
      },
    ];
  });

  return pickDiverseRediscoveries(candidates, limit).map(({ item }) => item);
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
  // Chemin rapide : agrégats quotidiens matérialisés. Repli sur les écoutes
  // brutes tant que la base n'a pas été backfillée.
  const stored = await getStoredDailyStats(userId);
  const daily =
    stored.length > 0 ? stored : await getActiveDays(userId, timeZone);
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
