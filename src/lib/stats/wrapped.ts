import "server-only";

import { prisma } from "../db";
import { hourOf } from "../format";
import { getTimeBuckets } from "./timeline";
import { bucketDate, buildWhere, parseGenres, type StatsRange } from "./shared";
import type { TopArtist } from "./rankings";

// --- Récapitulatif (« Wrapped ») --------------------------------------------

export type TimelineBucket = { key: string; msPlayed: number; plays: number };

export type WrappedExtras = {
  monthly: TimelineBucket[];
  daily: TimelineBucket[];
  busiestDay: TimelineBucket | null;
  busiestHour: { hour: number; plays: number } | null;
  activeDays: number;
};

/**
 * Agrégats temporels d'une période explicite (from/to) : cumuls mensuels,
 * quotidiens, jour et heure les plus actifs. Une seule lecture des écoutes.
 */
export async function getWrappedExtras(
  userId: string,
  timeZone: string,
  range: StatsRange,
): Promise<WrappedExtras> {
  const hourBuckets = await getTimeBuckets(userId, range);

  const daily = new Map<string, TimelineBucket>();
  const monthly = new Map<string, TimelineBucket>();
  const hours = new Array<number>(24).fill(0);

  for (const bucket of hourBuckets) {
    const date = bucketDate(bucket.bucket);
    // Clés en **UTC** : les périodes Wrapped sont des bornes UTC ; des clés
    // locales produisaient des tranches hors période (ex. un jour local basculant
    // sur le mois/année suivants) et un décalage avec `getOverview`.
    const dayKeyValue = date.toISOString().slice(0, 10);
    const monthKey = dayKeyValue.slice(0, 7);

    const day = daily.get(dayKeyValue) ?? {
      key: dayKeyValue,
      msPlayed: 0,
      plays: 0,
    };
    day.msPlayed += bucket.msPlayed;
    day.plays += bucket.plays;
    daily.set(dayKeyValue, day);

    const month = monthly.get(monthKey) ?? {
      key: monthKey,
      msPlayed: 0,
      plays: 0,
    };
    month.msPlayed += bucket.msPlayed;
    month.plays += bucket.plays;
    monthly.set(monthKey, month);

    hours[hourOf(date, timeZone)] += bucket.plays;
  }

  const dailyArr = [...daily.values()].sort((a, b) =>
    a.key.localeCompare(b.key),
  );
  const monthlyArr = [...monthly.values()].sort((a, b) =>
    a.key.localeCompare(b.key),
  );

  const busiestDay =
    dailyArr.length > 0
      ? dailyArr.reduce((max, cur) => (cur.msPlayed > max.msPlayed ? cur : max))
      : null;

  let busiestHour: { hour: number; plays: number } | null = null;
  hours.forEach((count, hour) => {
    if (count > 0 && (!busiestHour || count > busiestHour.plays)) {
      busiestHour = { hour, plays: count };
    }
  });

  return {
    monthly: monthlyArr,
    daily: dailyArr,
    busiestDay,
    busiestHour,
    activeDays: dailyArr.length,
  };
}

export type DiscoveredArtists = {
  count: number;
  artists: TopArtist[];
};

/** Artistes écoutés pour la première fois pendant la période. */
export async function getDiscoveredArtists(
  userId: string,
  range: StatsRange,
  limit = 5,
): Promise<DiscoveredArtists> {
  if (!range.from) return { count: 0, artists: [] };

  const [before, inRange] = await Promise.all([
    prisma.play.groupBy({
      by: ["artistId"],
      where: { userId, counted: true, playedAt: { lt: range.from } },
    }),
    prisma.play.groupBy({
      by: ["artistId"],
      where: buildWhere(userId, range),
      _count: { artistId: true },
      _sum: { msPlayed: true },
    }),
  ]);

  const known = new Set(before.map((row) => row.artistId));
  const discovered = inRange
    .filter((row) => !known.has(row.artistId))
    .sort((a, b) => b._count.artistId - a._count.artistId);

  const ids = discovered.slice(0, limit).map((row) => row.artistId);
  const artists = await prisma.artist.findMany({ where: { id: { in: ids } } });
  const byId = new Map(artists.map((a) => [a.id, a]));

  return {
    count: discovered.length,
    artists: discovered.slice(0, limit).flatMap((row) => {
      const artist = byId.get(row.artistId);
      if (!artist) return [];
      return [
        {
          id: artist.id,
          name: artist.name,
          plays: row._count.artistId,
          msPlayed: row._sum.msPlayed ?? 0,
          imageUrl: artist.imageUrl,
          genres: parseGenres(artist.genres),
        },
      ];
    }),
  };
}

/** Années pour lesquelles l'utilisateur possède des écoutes comptées (desc.). */
export async function getPlayingYears(userId: string): Promise<number[]> {
  const aggregate = await prisma.play.aggregate({
    where: { userId, counted: true },
    _min: { playedAt: true },
    _max: { playedAt: true },
  });
  if (!aggregate._min.playedAt || !aggregate._max.playedAt) return [];
  const years: number[] = [];
  for (
    let year = aggregate._max.playedAt.getUTCFullYear();
    year >= aggregate._min.playedAt.getUTCFullYear();
    year -= 1
  ) {
    years.push(year);
  }
  return years;
}
