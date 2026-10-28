import "server-only";

import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../db";
import { buildWhere, rangeConditions, type StatsRange } from "./shared";

export type Overview = {
  totalPlays: number;
  /** Toutes les écoutes (seuil appliqué ou non), pour le taux d'écoute complète. */
  allPlays: number;
  totalMs: number;
  distinctArtists: number;
  distinctTracks: number;
  distinctAlbums: number;
  firstPlay: Date | null;
  lastPlay: Date | null;
};

export async function getOverview(
  userId: string,
  range: StatsRange,
): Promise<Overview> {
  const where = buildWhere(userId, range);
  const [aggregate, distinct, allPlays] = await Promise.all([
    prisma.play.aggregate({
      where,
      _count: { _all: true },
      _sum: { msPlayed: true },
      _min: { playedAt: true },
      _max: { playedAt: true },
    }),
    // `COUNT(DISTINCT …)` côté PostgreSQL : on évite de rapatrier un triplet
    // (artiste, piste, album) par piste distincte juste pour compter des
    // ensembles. Le coût reste borné par l'index (userId, playedAt).
    prisma.$queryRaw<
      Array<{ artists: bigint; tracks: bigint; albums: bigint }>
    >(
      Prisma.sql`
        SELECT COUNT(DISTINCT "artistId")::bigint AS artists,
               COUNT(DISTINCT "trackId")::bigint AS tracks,
               COUNT(DISTINCT "albumId")::bigint AS albums
        FROM "Play"
        WHERE ${Prisma.join(rangeConditions(userId, range), " AND ")}
      `,
    ),
    // Même filtre sans `counted` : nombre total d'écoutes (toutes confondues).
    prisma.play.count({ where: { ...where, counted: undefined } }),
  ]);

  const row = distinct[0];

  return {
    totalPlays: aggregate._count._all,
    allPlays,
    totalMs: aggregate._sum.msPlayed ?? 0,
    distinctArtists: Number(row?.artists ?? 0),
    distinctTracks: Number(row?.tracks ?? 0),
    distinctAlbums: Number(row?.albums ?? 0),
    firstPlay: aggregate._min.playedAt ?? null,
    lastPlay: aggregate._max.playedAt ?? null,
  };
}

/** Indique si l'utilisateur possède au moins une écoute comptée (toutes périodes). */
export async function hasAnyPlays(userId: string): Promise<boolean> {
  const play = await prisma.play.findFirst({
    where: { userId, counted: true },
    select: { id: true },
  });
  return play !== null;
}

export type WindowStat = { plays: number; msPlayed: number };

/** Compte et durée des écoutes sur une fenêtre [from, to). */
export async function countWindow(
  userId: string,
  from: Date,
  to: Date,
): Promise<WindowStat> {
  const aggregate = await prisma.play.aggregate({
    where: { userId, counted: true, playedAt: { gte: from, lt: to } },
    _count: { _all: true },
    _sum: { msPlayed: true },
  });
  return {
    plays: aggregate._count._all,
    msPlayed: aggregate._sum.msPlayed ?? 0,
  };
}
