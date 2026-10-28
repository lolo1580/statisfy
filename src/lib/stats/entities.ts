import "server-only";

import { prisma } from "../db";
import { getDailyStats, type DailyStat } from "./timeline";
import {
  getTopAlbums,
  getTopTracks,
  type TopAlbum,
  type TopTrack,
} from "./rankings";
import { getOverview, type Overview } from "./overview";
import { buildWhere, parseGenres, type StatsRange } from "./shared";

export type RecentPlay = {
  id: string;
  playedAt: Date;
  trackId: string;
  trackName: string;
  artistId: string;
  artistName: string;
  albumName: string | null;
  imageUrl: string | null;
  msPlayed: number;
};

export async function getRecentPlays(
  userId: string,
  range: StatsRange,
  limit = 25,
): Promise<RecentPlay[]> {
  const plays = await prisma.play.findMany({
    where: buildWhere(userId, range),
    orderBy: { playedAt: "desc" },
    take: limit,
    include: { track: { include: { artist: true, album: true } } },
  });
  return plays.map((p) => ({
    id: p.id,
    playedAt: p.playedAt,
    trackId: p.track.id,
    trackName: p.track.name,
    artistId: p.track.artist.id,
    artistName: p.track.artist.name,
    albumName: p.track.album?.name ?? null,
    imageUrl: p.track.album?.imageUrl ?? p.track.imageUrl ?? null,
    msPlayed: p.msPlayed,
  }));
}

// --- Détails d'une entité ---------------------------------------------------

export type ArtistDetail = {
  artist: {
    id: string;
    name: string;
    imageUrl: string | null;
    genres: string[];
  };
  overview: Overview;
  topTracks: TopTrack[];
  topAlbums: TopAlbum[];
  daily: DailyStat[];
  recent: RecentPlay[];
};

export async function getArtistDetail(
  userId: string,
  artistId: string,
  range: StatsRange,
  timeZone: string,
): Promise<ArtistDetail | null> {
  const artist = await prisma.artist.findUnique({
    where: { id: artistId },
    select: { id: true, name: true, imageUrl: true, genres: true },
  });
  if (!artist) return null;

  const scoped: StatsRange = { ...range, artistId };
  const [overview, topTracks, topAlbums, daily, recent] = await Promise.all([
    getOverview(userId, scoped),
    getTopTracks(userId, scoped, 10, "time"),
    getTopAlbums(userId, scoped, 6, "time"),
    getDailyStats(userId, timeZone, scoped),
    getRecentPlays(userId, scoped, 15),
  ]);

  return {
    artist: {
      id: artist.id,
      name: artist.name,
      imageUrl: artist.imageUrl,
      genres: parseGenres(artist.genres),
    },
    overview,
    topTracks,
    topAlbums,
    daily,
    recent,
  };
}

export type TrackDetail = {
  track: {
    id: string;
    name: string;
    durationMs: number | null;
    imageUrl: string | null;
    isrc: string | null;
    artist: { id: string; name: string; imageUrl: string | null };
    album: { id: string; name: string; imageUrl: string | null } | null;
    genres: string[];
  };
  overview: Overview;
  daily: DailyStat[];
  recent: RecentPlay[];
};

export async function getTrackDetail(
  userId: string,
  trackId: string,
  range: StatsRange,
  timeZone: string,
): Promise<TrackDetail | null> {
  const track = await prisma.track.findUnique({
    where: { id: trackId },
    include: { artist: true, album: true },
  });
  if (!track) return null;

  const scoped: StatsRange = { ...range, trackId };
  const [overview, daily, recent] = await Promise.all([
    getOverview(userId, scoped),
    getDailyStats(userId, timeZone, scoped),
    getRecentPlays(userId, scoped, 15),
  ]);

  const genres = parseGenres(track.artist.genres);

  return {
    track: {
      id: track.id,
      name: track.name,
      durationMs: track.durationMs,
      imageUrl: track.album?.imageUrl ?? track.imageUrl,
      isrc: track.isrc,
      artist: {
        id: track.artist.id,
        name: track.artist.name,
        imageUrl: track.artist.imageUrl,
      },
      album: track.album
        ? {
            id: track.album.id,
            name: track.album.name,
            imageUrl: track.album.imageUrl,
          }
        : null,
      genres,
    },
    overview,
    daily,
    recent,
  };
}

// --- Recherche --------------------------------------------------------------

export type SearchResults = {
  artists: Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    plays: number;
    msPlayed: number;
  }>;
  tracks: Array<{
    id: string;
    name: string;
    artistId: string;
    artistName: string;
    albumName: string | null;
    imageUrl: string | null;
  }>;
};

/** Recherche d'artistes et de titres dans la bibliothèque de l'utilisateur. */
export async function searchLibrary(
  userId: string,
  query: string,
  limit = 10,
): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < 1) return { artists: [], tracks: [] };

  const [artists, tracks] = await Promise.all([
    prisma.artist.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
        plays: { some: { userId, counted: true } },
      },
      take: limit,
      orderBy: { name: "asc" },
    }),
    prisma.track.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
        plays: { some: { userId, counted: true } },
      },
      take: limit,
      include: { artist: true, album: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const artistPlays = await prisma.play.groupBy({
    by: ["artistId"],
    where: {
      userId,
      counted: true,
      artistId: { in: artists.map((a) => a.id) },
    },
    _count: { artistId: true },
    _sum: { msPlayed: true },
  });
  const playById = new Map(
    artistPlays.map((p) => [p.artistId, p._count.artistId]),
  );
  const msById = new Map(
    artistPlays.map((p) => [p.artistId, p._sum.msPlayed ?? 0]),
  );

  return {
    artists: artists.map((a) => ({
      id: a.id,
      name: a.name,
      imageUrl: a.imageUrl,
      plays: playById.get(a.id) ?? 0,
      msPlayed: msById.get(a.id) ?? 0,
    })),
    tracks: tracks.map((t) => ({
      id: t.id,
      name: t.name,
      artistId: t.artist.id,
      artistName: t.artist.name,
      albumName: t.album?.name ?? null,
      imageUrl: t.album?.imageUrl ?? t.imageUrl,
    })),
  };
}
