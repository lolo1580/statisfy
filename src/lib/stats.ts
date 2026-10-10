import 'server-only'

import { prisma } from './db'
import type { Prisma } from '../generated/prisma/client'
import { dayKey, getTimezoneOffsetMs, hourOf } from './format'

/**
 * Filtres applicables aux agrégations.
 * - `days: null` = tout l'historique.
 * - `source` restreint à une source (spotify, import).
 * - `artistId` / `trackId` / `albumId` restreignent à une entité.
 */
export type StatsRange = {
  days: number | null
  source?: string | null
  artistId?: string
  trackId?: string
  albumId?: string
  /** Bornes explicites (prioritaires sur `days`). `to` est exclusif. */
  from?: Date
  to?: Date
}

function buildWhere(userId: string, range: StatsRange): Prisma.PlayWhereInput {
  const where: Prisma.PlayWhereInput = { userId }
  if (range.from || range.to) {
    where.playedAt = {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lt: range.to } : {}),
    }
  } else if (range.days) {
    where.playedAt = {
      gte: new Date(Date.now() - range.days * 24 * 60 * 60 * 1000),
    }
  }
  if (range.source) where.source = range.source
  if (range.artistId) where.artistId = range.artistId
  if (range.trackId) where.trackId = range.trackId
  if (range.albumId) where.albumId = range.albumId
  return where
}

const DAY_MS = 24 * 60 * 60 * 1000;

export type Overview = {
  totalPlays: number
  totalMs: number
  distinctArtists: number
  distinctTracks: number
  distinctAlbums: number
  firstPlay: Date | null
  lastPlay: Date | null
}

export async function getOverview(
  userId: string,
  range: StatsRange,
): Promise<Overview> {
  const where = buildWhere(userId, range)
  const [aggregate, artistRows, trackRows, albumRows] = await Promise.all([
    prisma.play.aggregate({
      where,
      _count: { _all: true },
      _sum: { msPlayed: true },
      _min: { playedAt: true },
      _max: { playedAt: true },
    }),
    prisma.play.groupBy({ by: ['artistId'], where }),
    prisma.play.groupBy({ by: ['trackId'], where }),
    prisma.play.groupBy({ by: ['albumId'], where }),
  ])

  return {
    totalPlays: aggregate._count._all,
    totalMs: aggregate._sum.msPlayed ?? 0,
    distinctArtists: artistRows.length,
    distinctTracks: trackRows.length,
    distinctAlbums: albumRows.filter((r) => r.albumId !== null).length,
    firstPlay: aggregate._min.playedAt ?? null,
    lastPlay: aggregate._max.playedAt ?? null,
  }
}

export type WindowStat = { plays: number; msPlayed: number }

/** Compte et durée des écoutes sur une fenêtre [from, to). */
export async function countWindow(
  userId: string,
  from: Date,
  to: Date,
): Promise<WindowStat> {
  const aggregate = await prisma.play.aggregate({
    where: { userId, playedAt: { gte: from, lt: to } },
    _count: { _all: true },
    _sum: { msPlayed: true },
  })
  return {
    plays: aggregate._count._all,
    msPlayed: aggregate._sum.msPlayed ?? 0,
  }
}

export type TopTrack = {
  id: string
  name: string
  plays: number
  msPlayed: number
  artistId: string
  artistName: string
  albumName: string | null
  imageUrl: string | null
}

export async function getTopTracks(
  userId: string,
  range: StatsRange,
  limit = 10,
): Promise<TopTrack[]> {
  const where = buildWhere(userId, range)
  const grouped = await prisma.play.groupBy({
    by: ['trackId'],
    where,
    _count: { trackId: true },
    _sum: { msPlayed: true },
    orderBy: { _count: { trackId: 'desc' } },
    take: limit,
  })
  if (grouped.length === 0) return []

  const ids = grouped.map((g) => g.trackId)
  const tracks = await prisma.track.findMany({
    where: { id: { in: ids } },
    include: { artist: true, album: true },
  })
  const byId = new Map(tracks.map((t) => [t.id, t]))

  return grouped.flatMap((g) => {
    const track = byId.get(g.trackId)
    if (!track) return []
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
    ]
  })
}

export type TopArtist = {
  id: string
  name: string
  plays: number
  msPlayed: number
  imageUrl: string | null
  genres: string[]
}

export async function getTopArtists(
  userId: string,
  range: StatsRange,
  limit = 10,
): Promise<TopArtist[]> {
  const where = buildWhere(userId, range)
  const grouped = await prisma.play.groupBy({
    by: ['artistId'],
    where,
    _count: { artistId: true },
    _sum: { msPlayed: true },
    orderBy: { _count: { artistId: 'desc' } },
    take: limit,
  })
  if (grouped.length === 0) return []

  const ids = grouped.map((g) => g.artistId)
  const artists = await prisma.artist.findMany({ where: { id: { in: ids } } })
  const byId = new Map(artists.map((a) => [a.id, a]))

  return grouped.flatMap((g) => {
    const artist = byId.get(g.artistId)
    if (!artist) return []
    return [
      {
        id: artist.id,
        name: artist.name,
        plays: g._count.artistId,
        msPlayed: g._sum.msPlayed ?? 0,
        imageUrl: artist.imageUrl,
        genres: artist.genres ? (JSON.parse(artist.genres) as string[]) : [],
      },
    ]
  })
}

export type TopAlbum = {
  id: string
  name: string
  artistId: string
  artistName: string
  plays: number
  msPlayed: number
  imageUrl: string | null
}

export async function getTopAlbums(
  userId: string,
  range: StatsRange,
  limit = 10,
): Promise<TopAlbum[]> {
  const where: Prisma.PlayWhereInput = {
    ...buildWhere(userId, range),
    albumId: { not: null },
  }
  const grouped = await prisma.play.groupBy({
    by: ['albumId'],
    where,
    _count: { albumId: true },
    _sum: { msPlayed: true },
    orderBy: { _count: { albumId: 'desc' } },
    take: limit,
  })

  const ids = grouped.flatMap((g) => (g.albumId ? [g.albumId] : []))
  const albums = await prisma.album.findMany({
    where: { id: { in: ids } },
    include: { artist: true },
  })
  const byId = new Map(albums.map((a) => [a.id, a]))

  return grouped.flatMap((g) => {
    const album = g.albumId ? byId.get(g.albumId) : undefined
    if (!album) return []
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
    ]
  })
}

export type GenreStat = { genre: string; plays: number; msPlayed: number }

export async function getTopGenres(
  userId: string,
  range: StatsRange,
  limit = 12,
): Promise<GenreStat[]> {
  const where = buildWhere(userId, range)
  const grouped = await prisma.play.groupBy({
    by: ['artistId'],
    where,
    _count: { artistId: true },
    _sum: { msPlayed: true },
    orderBy: { _count: { artistId: 'desc' } },
    take: 100,
  })
  if (grouped.length === 0) return []

  const artists = await prisma.artist.findMany({
    where: { id: { in: grouped.map((g) => g.artistId) } },
    select: { id: true, genres: true },
  })
  const countById = new Map(grouped.map((g) => [g.artistId, g._count.artistId]))
  const msById = new Map(grouped.map((g) => [g.artistId, g._sum.msPlayed ?? 0]))

  const totals = new Map<string, { plays: number; msPlayed: number }>()
  for (const artist of artists) {
    if (!artist.genres) continue
    const plays = countById.get(artist.id) ?? 0
    const msPlayed = msById.get(artist.id) ?? 0
    for (const genre of JSON.parse(artist.genres) as string[]) {
      const current = totals.get(genre) ?? { plays: 0, msPlayed: 0 }
      current.plays += plays
      current.msPlayed += msPlayed
      totals.set(genre, current)
    }
  }

  return [...totals.entries()]
    .map(([genre, value]) => ({ genre, plays: value.plays, msPlayed: value.msPlayed }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, limit)
}

export type SourceStat = { source: string; plays: number; msPlayed: number }

/** Répartition des écoutes par source (Spotify, import). */
export async function getSourceBreakdown(
  userId: string,
  range: StatsRange,
): Promise<SourceStat[]> {
  const where = buildWhere(userId, range)
  const grouped = await prisma.play.groupBy({
    by: ['source'],
    where,
    _count: { source: true },
    _sum: { msPlayed: true },
    orderBy: { _count: { source: 'desc' } },
  })
  return grouped.map((g) => ({
    source: g.source,
    plays: g._count.source,
    msPlayed: g._sum.msPlayed ?? 0,
  }))
}

export type DailyStat = { day: string; msPlayed: number; plays: number }

export async function getDailyStats(
  userId: string,
  timeZone: string,
  range: StatsRange,
): Promise<DailyStat[]> {
  const baseWhere = buildWhere(userId, { ...range, days: null })

  // Fenêtre basse : borne `from` explicite, fenêtre glissante `days`, ou
  // tout l'historique (aucune borne) quand `days` est `null`.
  const since =
    range.from ??
    (range.days ? new Date(Date.now() - range.days * DAY_MS) : null)
  const where: Prisma.PlayWhereInput = since
    ? {
        ...baseWhere,
        playedAt: { gte: since, ...(range.to ? { lt: range.to } : {}) },
      }
    : baseWhere

  const plays = await prisma.play.findMany({
    where,
    select: { playedAt: true, msPlayed: true },
  })

  const offset = getTimezoneOffsetMs(timeZone)
  const buckets = new Map<string, DailyStat>()

  // Jour de départ : début de fenêtre, ou premier jour d'écoute pour « tout ».
  let startMs = Date.now()
  if (range.from) {
    startMs = range.from.getTime()
  } else if (range.days) {
    startMs = Date.now() - (range.days - 1) * DAY_MS
  } else {
    for (const play of plays) {
      const time = play.playedAt.getTime()
      if (time < startMs) startMs = time
    }
  }

  // Pré-remplit chaque jour (heure locale) afin d'avoir un graphe continu.
  const startDay = dayKey(new Date(startMs), timeZone, offset)
  const endDay = dayKey(new Date(), timeZone, offset)
  const totalDays = Math.max(
    1,
    Math.round(
      (Date.parse(`${endDay}T00:00:00Z`) - Date.parse(`${startDay}T00:00:00Z`)) /
        DAY_MS,
    ) + 1,
  )
  for (let i = 0; i < totalDays; i += 1) {
    const key = new Date(Date.parse(`${startDay}T00:00:00Z`) + i * DAY_MS)
      .toISOString()
      .slice(0, 10)
    buckets.set(key, { day: key, msPlayed: 0, plays: 0 })
  }

  for (const play of plays) {
    const key = dayKey(play.playedAt, timeZone, offset)
    const bucket = buckets.get(key) ?? { day: key, msPlayed: 0, plays: 0 }
    bucket.msPlayed += play.msPlayed
    bucket.plays += 1
    buckets.set(key, bucket)
  }

  return [...buckets.values()].sort((a, b) => a.day.localeCompare(b.day))
}

export type HourStat = { hour: number; plays: number }

export async function getHourlyStats(
  userId: string,
  timeZone: string,
  range: StatsRange,
): Promise<HourStat[]> {
  const baseWhere = buildWhere(userId, { ...range, days: null })
  const since =
    range.from ??
    (range.days ? new Date(Date.now() - range.days * DAY_MS) : null)
  const where: Prisma.PlayWhereInput = since
    ? {
        ...baseWhere,
        playedAt: { gte: since, ...(range.to ? { lt: range.to } : {}) },
      }
    : baseWhere
  const plays = await prisma.play.findMany({
    where,
    select: { playedAt: true },
  })

  const offset = getTimezoneOffsetMs(timeZone)
  const buckets: HourStat[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    plays: 0,
  }))
  for (const play of plays) {
    buckets[hourOf(play.playedAt, timeZone, offset)].plays += 1
  }
  return buckets
}

export type RecentPlay = {
  id: string
  playedAt: Date
  trackId: string
  trackName: string
  artistId: string
  artistName: string
  albumName: string | null
  imageUrl: string | null
  source: string
  msPlayed: number
}

export async function getRecentPlays(
  userId: string,
  range: StatsRange,
  limit = 25,
): Promise<RecentPlay[]> {
  const plays = await prisma.play.findMany({
    where: buildWhere(userId, range),
    orderBy: { playedAt: 'desc' },
    take: limit,
    include: { track: { include: { artist: true, album: true } } },
  })
  return plays.map((p) => ({
    id: p.id,
    playedAt: p.playedAt,
    trackId: p.track.id,
    trackName: p.track.name,
    artistId: p.track.artist.id,
    artistName: p.track.artist.name,
    albumName: p.track.album?.name ?? null,
    imageUrl: p.track.album?.imageUrl ?? p.track.imageUrl ?? null,
    source: p.source,
    msPlayed: p.msPlayed,
  }))
}

// --- Détails d'une entité ---------------------------------------------------

export type ArtistDetail = {
  artist: {
    id: string
    name: string
    imageUrl: string | null
    genres: string[]
  }
  overview: Overview
  topTracks: TopTrack[]
  topAlbums: TopAlbum[]
  daily: DailyStat[]
  sources: SourceStat[]
  recent: RecentPlay[]
}

export async function getArtistDetail(
  userId: string,
  artistId: string,
  range: StatsRange,
  timeZone: string,
): Promise<ArtistDetail | null> {
  const artist = await prisma.artist.findUnique({
    where: { id: artistId },
    select: { id: true, name: true, imageUrl: true, genres: true },
  })
  if (!artist) return null

  const scoped: StatsRange = { ...range, artistId }
  const [overview, topTracks, topAlbums, daily, sources, recent] =
    await Promise.all([
      getOverview(userId, scoped),
      getTopTracks(userId, scoped, 10),
      getTopAlbums(userId, scoped, 6),
      getDailyStats(userId, timeZone, scoped),
      getSourceBreakdown(userId, scoped),
      getRecentPlays(userId, scoped, 15),
    ])

  return {
    artist: {
      id: artist.id,
      name: artist.name,
      imageUrl: artist.imageUrl,
      genres: artist.genres ? (JSON.parse(artist.genres) as string[]) : [],
    },
    overview,
    topTracks,
    topAlbums,
    daily,
    sources,
    recent,
  }
}

export type TrackDetail = {
  track: {
    id: string
    name: string
    durationMs: number | null
    imageUrl: string | null
    isrc: string | null
    artist: { id: string; name: string; imageUrl: string | null }
    album: { id: string; name: string; imageUrl: string | null } | null
    genres: string[]
  }
  overview: Overview
  daily: DailyStat[]
  sources: SourceStat[]
  recent: RecentPlay[]
}

export async function getTrackDetail(
  userId: string,
  trackId: string,
  range: StatsRange,
  timeZone: string,
): Promise<TrackDetail | null> {
  const track = await prisma.track.findUnique({
    where: { id: trackId },
    include: { artist: true, album: true },
  })
  if (!track) return null

  const scoped: StatsRange = { ...range, trackId }
  const [overview, daily, sources, recent] = await Promise.all([
    getOverview(userId, scoped),
    getDailyStats(userId, timeZone, scoped),
    getSourceBreakdown(userId, scoped),
    getRecentPlays(userId, scoped, 15),
  ])

  const genres = track.artist.genres
    ? (JSON.parse(track.artist.genres) as string[])
    : []

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
    sources,
    recent,
  }
}

// --- Recherche --------------------------------------------------------------

export type SearchResults = {
  artists: Array<{
    id: string
    name: string
    imageUrl: string | null
    plays: number
    msPlayed: number
  }>
  tracks: Array<{
    id: string
    name: string
    artistId: string
    artistName: string
    albumName: string | null
    imageUrl: string | null
  }>
}

/** Recherche d'artistes et de titres dans la bibliothèque de l'utilisateur. */
export async function searchLibrary(
  userId: string,
  query: string,
  limit = 10,
): Promise<SearchResults> {
  const q = query.trim()
  if (q.length < 1) return { artists: [], tracks: [] }

  const [artists, tracks] = await Promise.all([
    prisma.artist.findMany({
      where: { name: { contains: q }, plays: { some: { userId } } },
      take: limit,
      orderBy: { name: 'asc' },
    }),
    prisma.track.findMany({
      where: { name: { contains: q }, plays: { some: { userId } } },
      take: limit,
      include: { artist: true, album: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const artistPlays = await prisma.play.groupBy({
    by: ['artistId'],
    where: { userId, artistId: { in: artists.map((a) => a.id) } },
    _count: { artistId: true },
    _sum: { msPlayed: true },
  })
  const playById = new Map(
    artistPlays.map((p) => [p.artistId, p._count.artistId]),
  )
  const msById = new Map(
    artistPlays.map((p) => [p.artistId, p._sum.msPlayed ?? 0]),
  )

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
  }
}

// --- Récapitulatif (« Wrapped ») --------------------------------------------

export type TimelineBucket = { key: string; msPlayed: number; plays: number }

export type WrappedExtras = {
  monthly: TimelineBucket[]
  daily: TimelineBucket[]
  busiestDay: TimelineBucket | null
  busiestHour: { hour: number; plays: number } | null
  activeDays: number
}

/**
 * Agrégats temporels d'une période explicite (from/to) : cumuls mensuels,
 * quotidiens, jour et heure les plus actifs. Une seule lecture des écoutes.
 */
export async function getWrappedExtras(
  userId: string,
  timeZone: string,
  range: StatsRange,
): Promise<WrappedExtras> {
  const plays = await prisma.play.findMany({
    where: buildWhere(userId, range),
    select: { playedAt: true, msPlayed: true },
  })

  const offset = getTimezoneOffsetMs(timeZone)
  const daily = new Map<string, TimelineBucket>()
  const monthly = new Map<string, TimelineBucket>()
  const hours = new Array<number>(24).fill(0)

  for (const play of plays) {
    const local = new Date(play.playedAt.getTime() + offset)
    const dayKeyValue = local.toISOString().slice(0, 10)
    const monthKey = dayKeyValue.slice(0, 7)

    const day = daily.get(dayKeyValue) ?? { key: dayKeyValue, msPlayed: 0, plays: 0 }
    day.msPlayed += play.msPlayed
    day.plays += 1
    daily.set(dayKeyValue, day)

    const month = monthly.get(monthKey) ?? { key: monthKey, msPlayed: 0, plays: 0 }
    month.msPlayed += play.msPlayed
    month.plays += 1
    monthly.set(monthKey, month)

    hours[local.getUTCHours()] += 1
  }

  const dailyArr = [...daily.values()].sort((a, b) => a.key.localeCompare(b.key))
  const monthlyArr = [...monthly.values()].sort((a, b) => a.key.localeCompare(b.key))

  const busiestDay =
    dailyArr.length > 0
      ? dailyArr.reduce((max, cur) => (cur.msPlayed > max.msPlayed ? cur : max))
      : null

  let busiestHour: { hour: number; plays: number } | null = null
  hours.forEach((count, hour) => {
    if (count > 0 && (!busiestHour || count > busiestHour.plays)) {
      busiestHour = { hour, plays: count }
    }
  })

  return {
    monthly: monthlyArr,
    daily: dailyArr,
    busiestDay,
    busiestHour,
    activeDays: dailyArr.length,
  }
}

export type DiscoveredArtists = {
  count: number
  artists: TopArtist[]
}/** Artistes écoutés pour la première fois pendant la période. */
export async function getDiscoveredArtists(
  userId: string,
  range: StatsRange,
  limit = 5,
): Promise<DiscoveredArtists> {
  if (!range.from) return { count: 0, artists: [] }

  const [before, inRange] = await Promise.all([
    prisma.play.groupBy({
      by: ['artistId'],
      where: { userId, playedAt: { lt: range.from } },
    }),
    prisma.play.groupBy({
      by: ['artistId'],
      where: buildWhere(userId, range),
      _count: { artistId: true },
    }),
  ])

  const known = new Set(before.map((row) => row.artistId))
  const discovered = inRange
    .filter((row) => !known.has(row.artistId))
    .sort((a, b) => b._count.artistId - a._count.artistId)

  const ids = discovered.slice(0, limit).map((row) => row.artistId)
  const artists = await prisma.artist.findMany({ where: { id: { in: ids } } })
  const byId = new Map(artists.map((a) => [a.id, a]))

  return {
    count: discovered.length,
    artists: discovered.slice(0, limit).flatMap((row) => {
      const artist = byId.get(row.artistId)
      if (!artist) return []
      return [
        {
          id: artist.id,
          name: artist.name,
          plays: row._count.artistId,
          msPlayed: 0,
          imageUrl: artist.imageUrl,
          genres: artist.genres ? (JSON.parse(artist.genres) as string[]) : [],
        },
      ]
    }),
  }
}

/** Années pour lesquelles l'utilisateur possède des écoutes (desc.). */
export async function getPlayingYears(userId: string): Promise<number[]> {
  const aggregate = await prisma.play.aggregate({
    where: { userId },
    _min: { playedAt: true },
    _max: { playedAt: true },
  })
  if (!aggregate._min.playedAt || !aggregate._max.playedAt) return []
  const years: number[] = []
  for (
    let year = aggregate._max.playedAt.getUTCFullYear();
    year >= aggregate._min.playedAt.getUTCFullYear();
    year -= 1
  ) {
    years.push(year)
  }
  return years
}

// --- Tendances / découvertes ------------------------------------------------

export type ArtistTrend = {
  id: string
  name: string
  imageUrl: string | null
  current: number
  previous: number
  delta: number
}

export type ArtistTrends = {
  rising: ArtistTrend[]
  falling: ArtistTrend[]
  hasPrevious: boolean
}

/**
 * Compare deux périodes consécutives de même durée et renvoie les artistes qui
 * progressent le plus (et ceux qui reculent).
 */
export async function getArtistTrends(
  userId: string,
  range: StatsRange,
  limit = 5,
): Promise<ArtistTrends> {
  if (!range.days) return { rising: [], falling: [], hasPrevious: false }

  const span = range.days * 24 * 60 * 60 * 1000
  const now = Date.now()
  const currentFrom = new Date(now - span)
  const currentTo = new Date(now)
  const previousFrom = new Date(now - 2 * span)
  const previousTo = currentFrom

  const windowWhere = (from: Date, to: Date): Prisma.PlayWhereInput => ({
    userId,
    ...(range.source ? { source: range.source } : {}),
    playedAt: { gte: from, lt: to },
  })

  const [current, previous] = await Promise.all([
    prisma.play.groupBy({
      by: ["artistId"],
      where: windowWhere(currentFrom, currentTo),
      _count: { artistId: true },
    }),
    prisma.play.groupBy({
      by: ["artistId"],
      where: windowWhere(previousFrom, previousTo),
      _count: { artistId: true },
    }),
  ])

  const currentMap = new Map(current.map((r) => [r.artistId, r._count.artistId]))
  const previousMap = new Map(
    previous.map((r) => [r.artistId, r._count.artistId]),
  )
  const ids = [...new Set([...currentMap.keys(), ...previousMap.keys()])]
  if (ids.length === 0) return { rising: [], falling: [], hasPrevious: false }

  const artists = await prisma.artist.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, imageUrl: true },
  })
  const byId = new Map(artists.map((a) => [a.id, a]))

  const rows: ArtistTrend[] = ids.map((id) => {
    const c = currentMap.get(id) ?? 0
    const p = previousMap.get(id) ?? 0
    return {
      id,
      name: byId.get(id)?.name ?? "—",
      imageUrl: byId.get(id)?.imageUrl ?? null,
      current: c,
      previous: p,
      delta: c - p,
    }
  })

  return {
    rising: rows
      .filter((r) => r.delta > 0)
      .sort((a, b) => b.delta - a.delta || b.current - a.current)
      .slice(0, limit),
    falling: rows
      .filter((r) => r.delta < 0)
      .sort((a, b) => a.delta - b.delta || a.current - b.current)
      .slice(0, limit),
    hasPrevious: previous.length > 0,
  }
}

export type Rediscovery = {
  id: string
  name: string
  imageUrl: string | null
  plays: number
  msPlayed: number
  lastPlayed: Date | null
}

/**
 * Artistes écoutés auparavant mais délaissés récemment (aucune écoute sur les
 * `recentDays` derniers jours), classés par nombre d'écoutes historiques.
 */
export async function getRediscoveries(
  userId: string,
  options: { recentDays?: number; minPlays?: number; limit?: number } = {},
): Promise<Rediscovery[]> {
  const recentDays = options.recentDays ?? 90
  const minPlays = options.minPlays ?? 5
  const limit = options.limit ?? 8
  const cutoff = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000)

  const [recent, all] = await Promise.all([
    prisma.play.groupBy({
      by: ["artistId"],
      where: { userId, playedAt: { gte: cutoff } },
    }),
    prisma.play.groupBy({
      by: ["artistId"],
      where: { userId },
      _count: { artistId: true },
      _sum: { msPlayed: true },
      _max: { playedAt: true },
    }),
  ])

  const recentSet = new Set(recent.map((r) => r.artistId))
  const candidates = all
    .filter((r) => !recentSet.has(r.artistId) && r._count.artistId >= minPlays)
    .sort((a, b) => b._count.artistId - a._count.artistId)
    .slice(0, limit)
  if (candidates.length === 0) return []

  const artists = await prisma.artist.findMany({
    where: { id: { in: candidates.map((c) => c.artistId) } },
    select: { id: true, name: true, imageUrl: true },
  })
  const byId = new Map(artists.map((a) => [a.id, a]))

  return candidates.flatMap((c) => {
    const artist = byId.get(c.artistId)
    if (!artist) return []
    return [
      {
        id: artist.id,
        name: artist.name,
        imageUrl: artist.imageUrl,
        plays: c._count.artistId,
        msPlayed: c._sum.msPlayed ?? 0,
        lastPlayed: c._max.playedAt ?? null,
      },
    ]
  })
}
