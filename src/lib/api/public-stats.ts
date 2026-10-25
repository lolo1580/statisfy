import "server-only";

import { prisma } from "../db";
import { parseRange } from "../range";
import {
  countWindow,
  getOverview,
  getTopArtists,
  getTopTracks,
  type Overview,
  type StatsRange,
  type TopArtist,
  type TopTrack,
  type WindowStat,
} from "../stats";

/**
 * API publique de statistiques (`GET /api/public/stats`).
 *
 * Lecture seule, par compte : le jeton est stocké sur `User.statsApiToken`
 * (opt-in, révocable depuis « Données personnelles »). Il permet d'alimenter
 * un widget de tableau de bord (Homepage, Grafana, etc.) sans ouvrir de session.
 */

export type StatsApiUser = {
  id: string;
  name: string;
  timezone: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Durée et taille maximale du cache mémoire des réponses. */
const PAYLOAD_CACHE_TTL_MS = 60_000;
const PAYLOAD_CACHE_MAX = 500;

type CachedPayload = { expiresAt: number; payload: StatsApiPayload };

const PAYLOAD_CACHE = new Map<string, CachedPayload>();

/** Retire les entrées expirées, puis la plus ancienne si le cache est plein. */
function prunePayloadCache(now: number): void {
  for (const [key, entry] of PAYLOAD_CACHE) {
    if (entry.expiresAt <= now) PAYLOAD_CACHE.delete(key);
  }
  if (PAYLOAD_CACHE.size < PAYLOAD_CACHE_MAX) return;
  const oldest = PAYLOAD_CACHE.keys().next().value;
  if (oldest !== undefined) PAYLOAD_CACHE.delete(oldest);
}

/** Retrouve le compte propriétaire d'un jeton (jeton opaque, non devinable). */
export async function getStatsApiUser(
  token: string | null | undefined,
): Promise<StatsApiUser | null> {
  if (!token) return null;
  const user = await prisma.user.findFirst({
    where: { statsApiToken: token },
    select: { id: true, name: true, timezone: true },
  });
  return user;
}

/** Jeton d'API actuel d'un compte (`null` si l'API est désactivée). */
export async function getStatsApiToken(
  userId: string,
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { statsApiToken: true },
  });
  return user?.statsApiToken ?? null;
}

/**
 * Extrait le jeton de la requête : en-tête `Authorization: Bearer` prioritaire,
 * sinon paramètre `?token=` (nécessaire aux widgets qui ne savent pas envoyer
 * d'en-tête, comme Homepage).
 */
export function readStatsToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
    if (match) return match[1].trim();
  }
  const token = new URL(request.url).searchParams.get("token");
  return token?.trim() || null;
}

/** Arrondit une durée en millisecondes vers un nombre d'heures à 0,1 près. */
function toHours(ms: number): number {
  return Math.round((ms / 3_600_000) * 10) / 10;
}

export type StatsApiAllTime = {
  plays: number;
  msPlayed: number;
  lastPlayAt: Date | null;
};

/** Totaux « depuis toujours » : une seule agrégation, sans groupBy. */
export async function getAllTimeStats(userId: string): Promise<StatsApiAllTime> {
  const aggregate = await prisma.play.aggregate({
    where: { userId, counted: true },
    _count: { _all: true },
    _sum: { msPlayed: true },
    _max: { playedAt: true },
  });
  return {
    plays: aggregate._count._all,
    msPlayed: aggregate._sum.msPlayed ?? 0,
    lastPlayAt: aggregate._max.playedAt ?? null,
  };
}

/** Charge toutes les données nécessaires en parallèle. */
export async function loadStatsApiPayload(
  user: StatsApiUser,
  rangeKey: string,
  now: Date = new Date(),
): Promise<StatsApiPayload> {
  const parsed = parseRange(rangeKey, user.timezone);

  // Cache mémoire court : les widgets interrogent souvent l'API, et les
  // agrégations (groupBy) ne doivent pas être rejouées à chaque rafraîchissement.
  const cacheKey = `${user.id}|${parsed.key}`;
  const cached = PAYLOAD_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > now.getTime()) return cached.payload;

  const range: StatsRange = {
    days: parsed.days,
    from: parsed.from,
    to: parsed.to,
  };

  // Fenêtres glissantes indépendantes de la période demandée : un widget peut
  // afficher « aujourd'hui / 7 jours / 30 jours » en un seul appel.
  const to = new Date(now.getTime() + 1);
  const todayRange = parseRange("today", user.timezone);
  const weekFrom = new Date(now.getTime() - 7 * DAY_MS);
  const monthFrom = new Date(now.getTime() - 30 * DAY_MS);

  const [
    overview,
    topArtists,
    topTracks,
    totals,
    today,
    week,
    month,
  ] = await Promise.all([
    getOverview(user.id, range),
    getTopArtists(user.id, range, 1),
    getTopTracks(user.id, range, 1),
    getAllTimeStats(user.id),
    countWindow(user.id, todayRange.from ?? new Date(now.getTime() - DAY_MS), to),
    countWindow(user.id, weekFrom, to),
    countWindow(user.id, monthFrom, to),
  ]);

  const payload = buildStatsApiPayload({
    user,
    rangeKey: parsed.key,
    rangeFrom: parsed.from ?? null,
    overview,
    topArtist: topArtists[0] ?? null,
    topTrack: topTracks[0] ?? null,
    totals,
    today,
    week,
    month,
    now,
  });

  prunePayloadCache(now.getTime());
  PAYLOAD_CACHE.set(cacheKey, {
    expiresAt: now.getTime() + PAYLOAD_CACHE_TTL_MS,
    payload,
  });
  return payload;
}

export type StatsApiPayload = {
  user: string;
  generatedAt: string;
  range: string;
  rangeFrom: string | null;
  plays: number;
  listeningMs: number;
  hours: number;
  artists: number;
  tracks: number;
  albums: number;
  allTimePlays: number;
  allTimeHours: number;
  lastPlayAt: string | null;
  todayPlays: number;
  todayHours: number;
  weekPlays: number;
  weekHours: number;
  monthPlays: number;
  monthHours: number;
  topArtist: string | null;
  topArtistPlays: number | null;
  topArtistImage: string | null;
  topTrack: string | null;
  topTrackArtist: string | null;
  topTrackPlays: number | null;
  topTrackImage: string | null;
};

/**
 * Construit la réponse publique. Fonction pure (hors requêtes) pour rester
 * testable et garder un contrat stable, sans imbrication : chaque champ est
 * directement mappable dans un widget `customapi` de Homepage.
 */
export function buildStatsApiPayload(input: {
  user: { name: string };
  rangeKey: string;
  rangeFrom: Date | null;
  overview: Overview;
  topArtist: TopArtist | null;
  topTrack: TopTrack | null;
  totals: StatsApiAllTime;
  today: WindowStat;
  week: WindowStat;
  month: WindowStat;
  now: Date;
}): StatsApiPayload {
  const { user, overview, topArtist, topTrack, totals } = input;

  return {
    user: user.name,
    generatedAt: input.now.toISOString(),
    range: input.rangeKey,
    rangeFrom: input.rangeFrom ? input.rangeFrom.toISOString() : null,
    plays: overview.totalPlays,
    listeningMs: overview.totalMs,
    hours: toHours(overview.totalMs),
    artists: overview.distinctArtists,
    tracks: overview.distinctTracks,
    albums: overview.distinctAlbums,
    allTimePlays: totals.plays,
    allTimeHours: toHours(totals.msPlayed),
    lastPlayAt: totals.lastPlayAt ? totals.lastPlayAt.toISOString() : null,
    todayPlays: input.today.plays,
    todayHours: toHours(input.today.msPlayed),
    weekPlays: input.week.plays,
    weekHours: toHours(input.week.msPlayed),
    monthPlays: input.month.plays,
    monthHours: toHours(input.month.msPlayed),
    topArtist: topArtist?.name ?? null,
    topArtistPlays: topArtist?.plays ?? null,
    topArtistImage: topArtist?.imageUrl ?? null,
    topTrack: topTrack?.name ?? null,
    topTrackArtist: topTrack?.artistName ?? null,
    topTrackPlays: topTrack?.plays ?? null,
    topTrackImage: topTrack?.imageUrl ?? null,
  };
}
