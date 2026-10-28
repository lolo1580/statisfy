import "server-only";

import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../db";
import { dayKey, hourOf } from "../format";
import {
  getStoredArtistDailyStats,
  getStoredDailyStats,
  getStoredTrackDailyStats,
} from "./daily-store";
import {
  BUCKET_SECONDS,
  DAY_MS,
  bucketDate,
  rangeConditions,
  type StatsRange,
} from "./shared";

export type DailyStat = { day: string; msPlayed: number; plays: number };

/**
 * Agrégation temporelle en SQL par **tranches de 15 minutes UTC** : nombre de
 * lignes borné (jamais plus que le nombre d'écoutes) et surtout bien inférieur
 * quand l'écoute est dense.
 *
 * Le pas de 15 min garantit que le début de tranche tombe exactement sur la
 * frontière de jour/heure locale pour tous les fuseaux modernes (offsets
 * multiples de 15 min), y compris ceux à offset `:30`/`:45`.
 */
export type TimeBucket = { bucket: number; plays: number; msPlayed: number };

export async function getTimeBuckets(
  userId: string,
  range: StatsRange,
): Promise<TimeBucket[]> {
  const conditions = rangeConditions(userId, range);

  // `EXTRACT(EPOCH FROM "playedAt")` renvoie les secondes depuis l'époque Unix.
  // Le timestamp (sans fuseau) est interprété en UTC : c'est l'équivalent de
  // `strftime('%s', playedAt)` en SQLite. Le cast `::bigint` tronque les
  // secondes comme le faisait `CAST(... AS INTEGER)`.
  const rows = await prisma.$queryRaw<
    Array<{
      bucket: number | bigint;
      plays: number | bigint;
      msPlayed: number | bigint;
    }>
  >(
    Prisma.sql`
      SELECT floor(EXTRACT(EPOCH FROM "playedAt") / ${BUCKET_SECONDS})::bigint AS bucket,
             COUNT(*) AS plays,
             COALESCE(SUM("msPlayed"), 0)::bigint AS "msPlayed"
      FROM "Play"
      WHERE ${Prisma.join(conditions, " AND ")}
      GROUP BY bucket
      ORDER BY bucket
    `,
  );
  return rows.map((row) => ({
    bucket: Number(row.bucket),
    plays: Number(row.plays),
    msPlayed: Number(row.msPlayed),
  }));
}

/** Construit une série continue à partir d'agrégats quotidiens matérialisés. */
function buildDailySeries(
  stats: readonly DailyStat[],
  timeZone: string,
  range: StatsRange,
): DailyStat[] {
  const now = new Date();
  const startDay = range.from
    ? dayKey(range.from, timeZone)
    : range.days
      ? dayKey(new Date(now.getTime() - range.days * DAY_MS), timeZone)
      : (stats[0]?.day ?? dayKey(now, timeZone));
  const endDay = dayKey(range.to ?? now, timeZone);

  const totalDays = Math.max(
    1,
    Math.round(
      (Date.parse(`${endDay}T00:00:00Z`) -
        Date.parse(`${startDay}T00:00:00Z`)) /
        DAY_MS,
    ) + 1,
  );

  const daily = new Map<string, DailyStat>();
  for (let i = 0; i < totalDays; i += 1) {
    const key = new Date(Date.parse(`${startDay}T00:00:00Z`) + i * DAY_MS)
      .toISOString()
      .slice(0, 10);
    daily.set(key, { day: key, msPlayed: 0, plays: 0 });
  }

  for (const stat of stats) {
    if (stat.day < startDay || stat.day > endDay) continue;
    const entry = daily.get(stat.day) ?? {
      day: stat.day,
      msPlayed: 0,
      plays: 0,
    };
    entry.msPlayed += stat.msPlayed;
    entry.plays += stat.plays;
    daily.set(stat.day, entry);
  }

  return [...daily.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export async function getDailyStats(
  userId: string,
  timeZone: string,
  range: StatsRange,
): Promise<DailyStat[]> {
  // Chemin rapide : agrégats quotidiens matérialisés (une ligne par jour).
  // Les tables artiste/titre couvrent les fiches détail ; l'album n'a pas de
  // page dédiée et retombe sur les écoutes brutes.
  const stored = range.artistId
    ? await getStoredArtistDailyStats(userId, range.artistId)
    : range.trackId
      ? await getStoredTrackDailyStats(userId, range.trackId)
      : range.albumId
        ? []
        : await getStoredDailyStats(userId);
  if (stored.length > 0) {
    return buildDailySeries(stored, timeZone, range);
  }

  // Repli pour les bases migrées mais pas encore backfillées.
  const buckets = await getTimeBuckets(userId, range);

  const daily = new Map<string, DailyStat>();

  // Jour de départ : début de fenêtre, ou premier jour d'écoute pour « tout ».
  let startMs = Date.now();
  if (range.from) {
    startMs = range.from.getTime();
  } else if (range.days) {
    startMs = Date.now() - range.days * DAY_MS;
  } else if (buckets.length > 0) {
    startMs = bucketDate(buckets[0].bucket).getTime();
  }

  // Pré-remplit chaque jour (heure locale) afin d'avoir un graphe continu.
  const startDay = dayKey(new Date(startMs), timeZone);
  const endDay = dayKey(range.to ?? new Date(), timeZone);
  const totalDays = Math.max(
    1,
    Math.round(
      (Date.parse(`${endDay}T00:00:00Z`) -
        Date.parse(`${startDay}T00:00:00Z`)) /
        DAY_MS,
    ) + 1,
  );
  for (let i = 0; i < totalDays; i += 1) {
    const key = new Date(Date.parse(`${startDay}T00:00:00Z`) + i * DAY_MS)
      .toISOString()
      .slice(0, 10);
    daily.set(key, { day: key, msPlayed: 0, plays: 0 });
  }

  for (const bucket of buckets) {
    const key = dayKey(bucketDate(bucket.bucket), timeZone);
    const stat = daily.get(key) ?? { day: key, msPlayed: 0, plays: 0 };
    stat.msPlayed += bucket.msPlayed;
    stat.plays += bucket.plays;
    daily.set(key, stat);
  }

  return [...daily.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export type HourStat = { hour: number; plays: number; msPlayed: number };

export type HourlyStats = { hours: HourStat[]; activeDays: number };

export type TimelineStats = { daily: DailyStat[]; hourly: HourlyStats };

/**
 * Série quotidienne **et** répartition horaire en une seule lecture des écoutes
 * (au lieu de deux scans complets). Utilisé par les pages qui affichent les
 * deux (tableau de bord, historique).
 */
export async function getTimelineStats(
  userId: string,
  timeZone: string,
  range: StatsRange,
): Promise<TimelineStats> {
  const hourBuckets = await getTimeBuckets(userId, range);

  const daily = new Map<string, DailyStat>();
  let startMs = Date.now();
  if (range.from) {
    startMs = range.from.getTime();
  } else if (range.days) {
    startMs = Date.now() - range.days * DAY_MS;
  } else if (hourBuckets.length > 0) {
    startMs = bucketDate(hourBuckets[0].bucket).getTime();
  }
  const startDay = dayKey(new Date(startMs), timeZone);
  const endDay = dayKey(range.to ?? new Date(), timeZone);
  const totalDays = Math.max(
    1,
    Math.round(
      (Date.parse(`${endDay}T00:00:00Z`) -
        Date.parse(`${startDay}T00:00:00Z`)) /
        DAY_MS,
    ) + 1,
  );
  for (let i = 0; i < totalDays; i += 1) {
    const key = new Date(Date.parse(`${startDay}T00:00:00Z`) + i * DAY_MS)
      .toISOString()
      .slice(0, 10);
    daily.set(key, { day: key, msPlayed: 0, plays: 0 });
  }

  const hours: HourStat[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    plays: 0,
    msPlayed: 0,
  }));
  const activeDays = new Set<string>();

  for (const bucket of hourBuckets) {
    const date = bucketDate(bucket.bucket);
    const key = dayKey(date, timeZone);
    const stat = daily.get(key) ?? { day: key, msPlayed: 0, plays: 0 };
    stat.msPlayed += bucket.msPlayed;
    stat.plays += bucket.plays;
    daily.set(key, stat);

    const hour = hours[hourOf(date, timeZone)];
    hour.plays += bucket.plays;
    hour.msPlayed += bucket.msPlayed;
    activeDays.add(key);
  }

  return {
    daily: [...daily.values()].sort((a, b) => a.day.localeCompare(b.day)),
    hourly: { hours, activeDays: activeDays.size },
  };
}
