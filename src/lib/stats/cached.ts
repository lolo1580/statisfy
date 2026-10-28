import * as raw from "../stats";
import { cacheGetOrSet, invalidateCache } from "../cache";
import type { ListeningRecords } from "../records";
import type { RankMetric, StatsRange } from "../stats";

/**
 * Variantes cachées des agrégations de statistiques.
 *
 * Les pages et routes en lecture seule importent ces fonctions à la place de
 * `@/lib/stats`. La durée de vie par défaut est de 60 s
 * (`STATS_CACHE_TTL_MS`, `0` pour désactiver). Le cache est invalidé par
 * utilisateur après une synchronisation ou un import (`invalidateUserStats`).
 */

const DEFAULT_TTL_MS = 60_000;

function cacheTtlMs(): number {
  const value = Number(process.env.STATS_CACHE_TTL_MS);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_TTL_MS;
}

function rangeKey(range: StatsRange): string {
  return [
    range.days ?? "all",
    range.from?.getTime() ?? "-",
    range.to?.getTime() ?? "-",
    range.artistId ?? "",
    range.trackId ?? "",
    range.albumId ?? "",
  ].join("|");
}

function key(
  userId: string,
  name: string,
  ...parts: Array<string | number | null | undefined>
): string {
  return ["stats", userId, name, ...parts.map((part) => part ?? "")].join(":");
}

function cached<T>(cacheKey: string, load: () => Promise<T>): Promise<T> {
  return cacheGetOrSet(cacheKey, cacheTtlMs(), load);
}

/** Invalide toutes les statistiques d'un utilisateur (sync, import, purge). */
export function invalidateUserStats(userId: string): void {
  invalidateCache(`stats:${userId}:`);
}

export function getOverview(
  userId: string,
  range: StatsRange,
): Promise<raw.Overview> {
  return cached(key(userId, "overview", rangeKey(range)), () =>
    raw.getOverview(userId, range),
  );
}

export function getTimelineStats(
  userId: string,
  timeZone: string,
  range: StatsRange,
): Promise<raw.TimelineStats> {
  return cached(key(userId, "timeline", timeZone, rangeKey(range)), () =>
    raw.getTimelineStats(userId, timeZone, range),
  );
}

export function getTopTracksBoth(
  userId: string,
  range: StatsRange,
  limit = 10,
  timeZone?: string,
): Promise<raw.RankPair<raw.TopTrack>> {
  return cached(
    key(userId, "tracks-both", limit, timeZone ?? "", rangeKey(range)),
    () => raw.getTopTracksBoth(userId, range, limit, timeZone),
  );
}

export function getTopArtistsBoth(
  userId: string,
  range: StatsRange,
  limit = 10,
  timeZone?: string,
): Promise<raw.RankPair<raw.TopArtist>> {
  return cached(
    key(userId, "artists-both", limit, timeZone ?? "", rangeKey(range)),
    () => raw.getTopArtistsBoth(userId, range, limit, timeZone),
  );
}

export function getTopGenresBoth(
  userId: string,
  range: StatsRange,
  limit = 12,
  timeZone?: string,
): Promise<raw.RankPair<raw.GenreStat>> {
  return cached(
    key(userId, "genres-both", limit, timeZone ?? "", rangeKey(range)),
    () => raw.getTopGenresBoth(userId, range, limit, timeZone),
  );
}

export function getTopTracks(
  userId: string,
  range: StatsRange,
  limit = 10,
  metric: RankMetric = "plays",
  timeZone?: string,
): Promise<raw.TopTrack[]> {
  return cached(
    key(userId, "tracks", limit, metric, timeZone ?? "", rangeKey(range)),
    () => raw.getTopTracks(userId, range, limit, metric, timeZone),
  );
}

export function getTopArtists(
  userId: string,
  range: StatsRange,
  limit = 10,
  metric: RankMetric = "plays",
  timeZone?: string,
): Promise<raw.TopArtist[]> {
  return cached(
    key(userId, "artists", limit, metric, timeZone ?? "", rangeKey(range)),
    () => raw.getTopArtists(userId, range, limit, metric, timeZone),
  );
}

export function getTopAlbums(
  userId: string,
  range: StatsRange,
  limit = 10,
  metric: RankMetric = "plays",
): Promise<raw.TopAlbum[]> {
  return cached(key(userId, "albums", limit, metric, rangeKey(range)), () =>
    raw.getTopAlbums(userId, range, limit, metric),
  );
}

export function getTopGenres(
  userId: string,
  range: StatsRange,
  limit = 12,
  metric: RankMetric = "plays",
  timeZone?: string,
): Promise<raw.GenreStat[]> {
  return cached(
    key(userId, "genres", limit, metric, timeZone ?? "", rangeKey(range)),
    () => raw.getTopGenres(userId, range, limit, metric, timeZone),
  );
}

export function getRecords(
  userId: string,
  timeZone: string,
): Promise<ListeningRecords> {
  return cached(key(userId, "records", timeZone), () =>
    raw.getRecords(userId, timeZone),
  );
}

export function getRediscoveries(
  userId: string,
  options: { afterDays?: number; minPlays?: number; limit?: number } = {},
): Promise<raw.RediscoveredArtist[]> {
  const { afterDays = 60, minPlays = 5, limit = 5 } = options;
  return cached(key(userId, "rediscoveries", afterDays, minPlays, limit), () =>
    raw.getRediscoveries(userId, options),
  );
}

export function getDailyStats(
  userId: string,
  timeZone: string,
  range: StatsRange,
): Promise<raw.DailyStat[]> {
  return cached(key(userId, "daily", timeZone, rangeKey(range)), () =>
    raw.getDailyStats(userId, timeZone, range),
  );
}

export function getWeeklyHourStats(
  userId: string,
  timeZone: string,
  range: StatsRange,
): Promise<raw.WeeklyHourHeatmap> {
  return cached(key(userId, "weekly-hour", timeZone, rangeKey(range)), () =>
    raw.getWeeklyHourStats(userId, timeZone, range),
  );
}

export function getListeningBehavior(
  userId: string,
): Promise<raw.ListeningBehavior> {
  return cached(key(userId, "behavior"), () =>
    raw.getListeningBehavior(userId),
  );
}

export function getRecentPlays(
  userId: string,
  range: StatsRange,
  limit = 25,
): Promise<raw.RecentPlay[]> {
  return cached(key(userId, "recent", limit, rangeKey(range)), () =>
    raw.getRecentPlays(userId, range, limit),
  );
}

export function getWrappedExtras(
  userId: string,
  timeZone: string,
  range: StatsRange,
): Promise<raw.WrappedExtras> {
  return cached(key(userId, "wrapped", timeZone, rangeKey(range)), () =>
    raw.getWrappedExtras(userId, timeZone, range),
  );
}

export function getDiscoveredArtists(
  userId: string,
  range: StatsRange,
  limit = 5,
): Promise<raw.DiscoveredArtists> {
  return cached(key(userId, "discovered", limit, rangeKey(range)), () =>
    raw.getDiscoveredArtists(userId, range, limit),
  );
}

export function getPlayingYears(userId: string): Promise<number[]> {
  return cached(key(userId, "years"), () => raw.getPlayingYears(userId));
}

export function getArtistDetail(
  userId: string,
  artistId: string,
  range: StatsRange,
  timeZone: string,
): Promise<raw.ArtistDetail | null> {
  return cached(
    key(userId, "artist", artistId, timeZone, rangeKey(range)),
    () => raw.getArtistDetail(userId, artistId, range, timeZone),
  );
}

export function getTrackDetail(
  userId: string,
  trackId: string,
  range: StatsRange,
  timeZone: string,
): Promise<raw.TrackDetail | null> {
  return cached(key(userId, "track", trackId, timeZone, rangeKey(range)), () =>
    raw.getTrackDetail(userId, trackId, range, timeZone),
  );
}

export function searchLibrary(
  userId: string,
  query: string,
  limit = 10,
): Promise<raw.SearchResults> {
  return cached(key(userId, "search", query.trim(), limit), () =>
    raw.searchLibrary(userId, query, limit),
  );
}
