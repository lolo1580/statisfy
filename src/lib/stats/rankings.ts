import "server-only";

import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../db";
import {
  buildWhere,
  parseGenres,
  rangeConditions,
  rangeDayBounds,
  type RangeDayBounds,
  type StatsRange,
} from "./shared";

export type TopTrack = {
  id: string;
  name: string;
  plays: number;
  msPlayed: number;
  artistId: string;
  artistName: string;
  albumName: string | null;
  imageUrl: string | null;
};

/** Métrique de classement : nombre d'écoutes ou temps d'écoute. */
export type RankMetric = "plays" | "time";

export async function getTopTracks(
  userId: string,
  range: StatsRange,
  limit = 10,
  metric: RankMetric = "plays",
  timeZone?: string,
): Promise<TopTrack[]> {
  // Période alignée sur des jours locaux : le classement vient des agrégats.
  if (timeZone && rangeDayBounds(range, timeZone)) {
    const pair = await getTopTracksBoth(userId, range, limit, timeZone);
    return metric === "time" ? pair.time : pair.plays;
  }

  const where = buildWhere(userId, range);
  const grouped = await prisma.play.groupBy({
    by: ["trackId"],
    where,
    _count: { trackId: true },
    _sum: { msPlayed: true },
    orderBy:
      metric === "time"
        ? { _sum: { msPlayed: "desc" } }
        : { _count: { trackId: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];

  const ids = grouped.map((g) => g.trackId);
  const tracks = await prisma.track.findMany({
    where: { id: { in: ids } },
    include: { artist: true, album: true },
  });
  const byId = new Map(tracks.map((t) => [t.id, t]));

  return grouped.flatMap((g) => {
    const track = byId.get(g.trackId);
    if (!track) return [];
    return [
      {
        id: track.id,
        name: track.name,
        plays: g._count.trackId,
        msPlayed: g._sum.msPlayed ?? 0,
        artistId: track.artist.id,
        artistName: track.artist.name,
        albumName: track.album?.name ?? null,
        imageUrl: track.album?.imageUrl ?? track.imageUrl ?? null,
      },
    ];
  });
}

export type TopArtist = {
  id: string;
  name: string;
  plays: number;
  msPlayed: number;
  imageUrl: string | null;
  genres: string[];
};

/** Deux classements d'une même entité : par écoutes et par temps. */
export type RankPair<T> = { plays: T[]; time: T[] };

type RankedId = { id: string; plays: number; msPlayed: number };

type RankedIdRow = {
  id: string;
  plays: number | string | bigint;
  msPlayed: number | string | bigint;
  rp: number | string | bigint;
  rt: number | string | bigint;
  by_plays: boolean;
  by_time: boolean;
};

/**
 * Identifiants des `limit` premiers **par écoutes et par temps** en une seule
 * agrégation (fonctions de fenêtrage). Évite de scanner deux fois `Play` par
 * entité sur le tableau de bord.
 *
 * `column` est une union fermée, jamais une entrée utilisateur.
 */
async function rankedPlayIds(
  userId: string,
  range: StatsRange,
  limit: number,
  column: "trackId" | "artistId",
): Promise<{ plays: RankedId[]; time: RankedId[] }> {
  const col =
    column === "trackId" ? Prisma.sql`"trackId"` : Prisma.sql`"artistId"`;
  const rows = await prisma.$queryRaw<RankedIdRow[]>(
    Prisma.sql`
      WITH agg AS (
        SELECT ${col} AS id,
               COUNT(*)::int AS plays,
               COALESCE(SUM("msPlayed"), 0)::bigint AS "msPlayed"
        FROM "Play"
        WHERE ${Prisma.join(rangeConditions(userId, range), " AND ")}
        GROUP BY ${col}
      ),
      ranked AS (
        SELECT id, plays, "msPlayed",
               row_number() OVER (ORDER BY plays DESC, id) AS rp,
               row_number() OVER (ORDER BY "msPlayed" DESC, id) AS rt
        FROM agg
      )
      SELECT id, plays, "msPlayed", rp, rt,
             (rp <= ${limit}) AS by_plays,
             (rt <= ${limit}) AS by_time
      FROM ranked
      WHERE rp <= ${limit} OR rt <= ${limit}
    `,
  );

  return toRankPair(rows);
}

function toRankPair(rows: RankedIdRow[]): {
  plays: RankedId[];
  time: RankedId[];
} {
  const toId = (row: RankedIdRow): RankedId => ({
    id: row.id,
    plays: Number(row.plays),
    msPlayed: Number(row.msPlayed),
  });

  return {
    plays: rows
      .filter((row) => row.by_plays)
      .sort((a, b) => Number(a.rp) - Number(b.rp))
      .map(toId),
    time: rows
      .filter((row) => row.by_time)
      .sort((a, b) => Number(a.rt) - Number(b.rt))
      .map(toId),
  };
}

/**
 * Même classement, mais calculé sur les agrégats quotidiens par entité :
 * bien moins de lignes à parcourir sur « tout l'historique » ou une période
 * alignée sur des jours locaux.
 */
async function rankedAggregateIds(
  userId: string,
  bounds: RangeDayBounds,
  limit: number,
  column: "trackId" | "artistId",
): Promise<{ plays: RankedId[]; time: RankedId[] }> {
  const col =
    column === "trackId" ? Prisma.sql`"trackId"` : Prisma.sql`"artistId"`;
  const table =
    column === "trackId"
      ? Prisma.sql`"UserTrackDailyStat"`
      : Prisma.sql`"UserArtistDailyStat"`;

  const conditions: Prisma.Sql[] = [Prisma.sql`"userId" = ${userId}`];
  if (bounds.fromDay) {
    conditions.push(Prisma.sql`"day" >= ${bounds.fromDay}`);
  }
  if (bounds.toDay) {
    conditions.push(Prisma.sql`"day" <= ${bounds.toDay}`);
  }

  const rows = await prisma.$queryRaw<RankedIdRow[]>(
    Prisma.sql`
      WITH agg AS (
        SELECT ${col} AS id,
               SUM("plays")::int AS plays,
               COALESCE(SUM("msPlayed"), 0)::bigint AS "msPlayed"
        FROM ${table}
        WHERE ${Prisma.join(conditions, " AND ")}
        GROUP BY ${col}
      ),
      ranked AS (
        SELECT id, plays, "msPlayed",
               row_number() OVER (ORDER BY plays DESC, id) AS rp,
               row_number() OVER (ORDER BY "msPlayed" DESC, id) AS rt
        FROM agg
      )
      SELECT id, plays, "msPlayed", rp, rt,
             (rp <= ${limit}) AS by_plays,
             (rt <= ${limit}) AS by_time
      FROM ranked
      WHERE rp <= ${limit} OR rt <= ${limit}
    `,
  );

  return toRankPair(rows);
}

/** Classement via agrégats si la période est exprimable en jours locaux. */
async function rankedIds(
  userId: string,
  range: StatsRange,
  limit: number,
  column: "trackId" | "artistId",
  timeZone?: string,
): Promise<{ plays: RankedId[]; time: RankedId[] }> {
  const bounds = timeZone ? rangeDayBounds(range, timeZone) : null;
  if (bounds) return rankedAggregateIds(userId, bounds, limit, column);
  return rankedPlayIds(userId, range, limit, column);
}

/** Top titres, par écoutes **et** par temps, avec une seule lecture des titres. */
export async function getTopTracksBoth(
  userId: string,
  range: StatsRange,
  limit = 10,
  timeZone?: string,
): Promise<RankPair<TopTrack>> {
  const ranked = await rankedIds(userId, range, limit, "trackId", timeZone);
  const ids = [...new Set([...ranked.plays, ...ranked.time].map((r) => r.id))];
  if (ids.length === 0) return { plays: [], time: [] };

  const tracks = await prisma.track.findMany({
    where: { id: { in: ids } },
    include: { artist: true, album: true },
  });
  const byId = new Map(tracks.map((track) => [track.id, track]));

  const map = (rows: RankedId[]): TopTrack[] =>
    rows.flatMap((row) => {
      const track = byId.get(row.id);
      if (!track) return [];
      return [
        {
          id: track.id,
          name: track.name,
          plays: row.plays,
          msPlayed: row.msPlayed,
          artistId: track.artist.id,
          artistName: track.artist.name,
          albumName: track.album?.name ?? null,
          imageUrl: track.album?.imageUrl ?? track.imageUrl ?? null,
        },
      ];
    });

  return { plays: map(ranked.plays), time: map(ranked.time) };
}

/** Top artistes, par écoutes **et** par temps, avec une seule lecture des artistes. */
export async function getTopArtistsBoth(
  userId: string,
  range: StatsRange,
  limit = 10,
  timeZone?: string,
): Promise<RankPair<TopArtist>> {
  const ranked = await rankedIds(userId, range, limit, "artistId", timeZone);
  const ids = [...new Set([...ranked.plays, ...ranked.time].map((r) => r.id))];
  if (ids.length === 0) return { plays: [], time: [] };

  const artists = await prisma.artist.findMany({ where: { id: { in: ids } } });
  const byId = new Map(artists.map((artist) => [artist.id, artist]));

  const map = (rows: RankedId[]): TopArtist[] =>
    rows.flatMap((row) => {
      const artist = byId.get(row.id);
      if (!artist) return [];
      return [
        {
          id: artist.id,
          name: artist.name,
          plays: row.plays,
          msPlayed: row.msPlayed,
          imageUrl: artist.imageUrl,
          genres: parseGenres(artist.genres),
        },
      ];
    });

  return { plays: map(ranked.plays), time: map(ranked.time) };
}

export async function getTopArtists(
  userId: string,
  range: StatsRange,
  limit = 10,
  metric: RankMetric = "plays",
  timeZone?: string,
): Promise<TopArtist[]> {
  // Période alignée sur des jours locaux : le classement vient des agrégats.
  if (timeZone && rangeDayBounds(range, timeZone)) {
    const pair = await getTopArtistsBoth(userId, range, limit, timeZone);
    return metric === "time" ? pair.time : pair.plays;
  }

  const where = buildWhere(userId, range);
  const grouped = await prisma.play.groupBy({
    by: ["artistId"],
    where,
    _count: { artistId: true },
    _sum: { msPlayed: true },
    orderBy:
      metric === "time"
        ? { _sum: { msPlayed: "desc" } }
        : { _count: { artistId: "desc" } },
    take: limit,
  });
  if (grouped.length === 0) return [];

  const ids = grouped.map((g) => g.artistId);
  const artists = await prisma.artist.findMany({ where: { id: { in: ids } } });
  const byId = new Map(artists.map((a) => [a.id, a]));

  return grouped.flatMap((g) => {
    const artist = byId.get(g.artistId);
    if (!artist) return [];
    return [
      {
        id: artist.id,
        name: artist.name,
        plays: g._count.artistId,
        msPlayed: g._sum.msPlayed ?? 0,
        imageUrl: artist.imageUrl,
        genres: parseGenres(artist.genres),
      },
    ];
  });
}

export type TopAlbum = {
  id: string;
  name: string;
  artistId: string;
  artistName: string;
  plays: number;
  msPlayed: number;
  imageUrl: string | null;
};

export async function getTopAlbums(
  userId: string,
  range: StatsRange,
  limit = 10,
  metric: RankMetric = "plays",
): Promise<TopAlbum[]> {
  const where: Prisma.PlayWhereInput = {
    ...buildWhere(userId, range),
    albumId: { not: null },
  };
  const grouped = await prisma.play.groupBy({
    by: ["albumId"],
    where,
    _count: { albumId: true },
    _sum: { msPlayed: true },
    orderBy:
      metric === "time"
        ? { _sum: { msPlayed: "desc" } }
        : { _count: { albumId: "desc" } },
    take: limit,
  });

  const ids = grouped.flatMap((g) => (g.albumId ? [g.albumId] : []));
  const albums = await prisma.album.findMany({
    where: { id: { in: ids } },
    include: { artist: true },
  });
  const byId = new Map(albums.map((a) => [a.id, a]));

  return grouped.flatMap((g) => {
    const album = g.albumId ? byId.get(g.albumId) : undefined;
    if (!album) return [];
    return [
      {
        id: album.id,
        name: album.name,
        artistId: album.artist.id,
        artistName: album.artist.name,
        plays: g._count.albumId ?? 0,
        msPlayed: g._sum.msPlayed ?? 0,
        imageUrl: album.imageUrl,
      },
    ];
  });
}

export type GenreStat = { genre: string; plays: number; msPlayed: number };

async function collectGenreTotals(
  userId: string,
  range: StatsRange,
  timeZone?: string,
): Promise<Map<string, { plays: number; msPlayed: number }>> {
  const bounds = timeZone ? rangeDayBounds(range, timeZone) : null;

  let grouped: Array<{ artistId: string; plays: number; msPlayed: number }>;

  if (bounds) {
    const conditions: Prisma.Sql[] = [Prisma.sql`"userId" = ${userId}`];
    if (bounds.fromDay) {
      conditions.push(Prisma.sql`"day" >= ${bounds.fromDay}`);
    }
    if (bounds.toDay) {
      conditions.push(Prisma.sql`"day" <= ${bounds.toDay}`);
    }
    const rows = await prisma.$queryRaw<
      Array<{ id: string; plays: number | bigint; msPlayed: number | bigint }>
    >(
      Prisma.sql`
        SELECT "artistId" AS id,
               SUM("plays")::int AS plays,
               COALESCE(SUM("msPlayed"), 0)::bigint AS "msPlayed"
        FROM "UserArtistDailyStat"
        WHERE ${Prisma.join(conditions, " AND ")}
        GROUP BY "artistId"
      `,
    );
    grouped = rows.map((row) => ({
      artistId: row.id,
      plays: Number(row.plays),
      msPlayed: Number(row.msPlayed),
    }));
  } else {
    // Pas de `take` : les genres doivent agréger **tous** les artistes écoutés,
    // sinon les genres des artistes hors du top-100 (par écoutes) disparaissent
    // et le classement est faussé.
    const rows = await prisma.play.groupBy({
      by: ["artistId"],
      where: buildWhere(userId, range),
      _count: { artistId: true },
      _sum: { msPlayed: true },
    });
    grouped = rows.map((row) => ({
      artistId: row.artistId,
      plays: row._count.artistId,
      msPlayed: row._sum.msPlayed ?? 0,
    }));
  }

  const totals = new Map<string, { plays: number; msPlayed: number }>();
  if (grouped.length === 0) return totals;

  const artists = await prisma.artist.findMany({
    where: { id: { in: grouped.map((row) => row.artistId) } },
    select: { id: true, genres: true },
  });
  const byId = new Map(
    grouped.map((row) => [
      row.artistId,
      { plays: row.plays, msPlayed: row.msPlayed },
    ]),
  );

  for (const artist of artists) {
    if (!artist.genres) continue;
    const values = byId.get(artist.id);
    if (!values) continue;
    for (const genre of parseGenres(artist.genres)) {
      const current = totals.get(genre) ?? { plays: 0, msPlayed: 0 };
      current.plays += values.plays;
      current.msPlayed += values.msPlayed;
      totals.set(genre, current);
    }
  }
  return totals;
}

function rankGenres(
  totals: Map<string, { plays: number; msPlayed: number }>,
  limit: number,
  metric: RankMetric,
): GenreStat[] {
  return [...totals.entries()]
    .map(([genre, value]) => ({
      genre,
      plays: value.plays,
      msPlayed: value.msPlayed,
    }))
    .sort((a, b) =>
      metric === "time" ? b.msPlayed - a.msPlayed : b.plays - a.plays,
    )
    .slice(0, limit);
}

export async function getTopGenres(
  userId: string,
  range: StatsRange,
  limit = 12,
  metric: RankMetric = "plays",
  timeZone?: string,
): Promise<GenreStat[]> {
  return rankGenres(
    await collectGenreTotals(userId, range, timeZone),
    limit,
    metric,
  );
}

/** Top genres, par écoutes **et** par temps, en une seule agrégation. */
export async function getTopGenresBoth(
  userId: string,
  range: StatsRange,
  limit = 12,
  timeZone?: string,
): Promise<RankPair<GenreStat>> {
  const totals = await collectGenreTotals(userId, range, timeZone);
  return {
    plays: rankGenres(totals, limit, "plays"),
    time: rankGenres(totals, limit, "time"),
  };
}
