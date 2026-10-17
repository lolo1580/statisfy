import 'server-only'

import { prisma } from './db'
import { Prisma } from '../generated/prisma/client'
import { dayKey, hourOf } from './format'
import { computeRecords, type ListeningRecords } from './records'

/**
 * Filtres applicables aux agrégations.
 * - `days: null` = tout l'historique.
 * - `artistId` / `trackId` / `albumId` restreignent à une entité.
 */
export type StatsRange = {
  days: number | null
  artistId?: string
  trackId?: string
  albumId?: string
  /** Bornes explicites (prioritaires sur `days`). `to` est exclusif. */
  from?: Date
  to?: Date
}

function buildWhere(userId: string, range: StatsRange): Prisma.PlayWhereInput {
  const where: Prisma.PlayWhereInput = { userId, counted: true }
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
  if (range.artistId) where.artistId = range.artistId
  if (range.trackId) where.trackId = range.trackId
  if (range.albumId) where.albumId = range.albumId
  return where
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse défensif du JSON des genres stockés (`[]` si absent ou corrompu). */
function parseGenres(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    // Dédoublonne : un même genre présent deux fois serait compté deux fois.
    return [...new Set(parsed.filter((g): g is string => typeof g === "string"))];
  } catch {
    return [];
  }
}

export type Overview = {
  totalPlays: number
  /** Toutes les écoutes (seuil appliqué ou non), pour le taux d'écoute complète. */
  allPlays: number
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
  const [aggregate, combos, allPlays] = await Promise.all([
    prisma.play.aggregate({
      where,
      _count: { _all: true },
      _sum: { msPlayed: true },
      _min: { playedAt: true },
      _max: { playedAt: true },
    }),
    // Un seul groupBy multi-clés (au lieu de 3) : les triplets (artiste, piste,
    // album) sont ≤ au nombre de pistes distinctes, donc moins de lignes que la
    // somme des trois groupBy séparés.
    prisma.play.groupBy({
      by: ['artistId', 'trackId', 'albumId'],
      where,
    }),
    // Même filtre sans `counted` : nombre total d'écoutes (toutes confondues).
    prisma.play.count({ where: { ...where, counted: undefined } }),
  ])

  const artists = new Set<string>()
  const tracks = new Set<string>()
  const albums = new Set<string>()
  for (const row of combos) {
    artists.add(row.artistId)
    tracks.add(row.trackId)
    if (row.albumId) albums.add(row.albumId)
  }

  return {
    totalPlays: aggregate._count._all,
    allPlays,
    totalMs: aggregate._sum.msPlayed ?? 0,
    distinctArtists: artists.size,
    distinctTracks: tracks.size,
    distinctAlbums: albums.size,
    firstPlay: aggregate._min.playedAt ?? null,
    lastPlay: aggregate._max.playedAt ?? null,
  }
}

/** Indique si l'utilisateur possède au moins une écoute comptée (toutes périodes). */
export async function hasAnyPlays(userId: string): Promise<boolean> {
  const play = await prisma.play.findFirst({
    where: { userId, counted: true },
    select: { id: true },
  })
  return play !== null
}

export type WindowStat = { plays: number; msPlayed: number }

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

/** Métrique de classement : nombre d'écoutes ou temps d'écoute. */
export type RankMetric = 'plays' | 'time'

export async function getTopTracks(
  userId: string,
  range: StatsRange,
  limit = 10,
  metric: RankMetric = 'plays',
): Promise<TopTrack[]> {
  const where = buildWhere(userId, range)
  const grouped = await prisma.play.groupBy({
    by: ['trackId'],
    where,
    _count: { trackId: true },
    _sum: { msPlayed: true },
    orderBy:
      metric === 'time'
        ? { _sum: { msPlayed: 'desc' } }
        : { _count: { trackId: 'desc' } },
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
  metric: RankMetric = 'plays',
): Promise<TopArtist[]> {
  const where = buildWhere(userId, range)
  const grouped = await prisma.play.groupBy({
    by: ['artistId'],
    where,
    _count: { artistId: true },
    _sum: { msPlayed: true },
    orderBy:
      metric === 'time'
        ? { _sum: { msPlayed: 'desc' } }
        : { _count: { artistId: 'desc' } },
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
        genres: parseGenres(artist.genres),
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
  metric: RankMetric = 'plays',
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
    orderBy:
      metric === 'time'
        ? { _sum: { msPlayed: 'desc' } }
        : { _count: { albumId: 'desc' } },
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
  metric: RankMetric = 'plays',
): Promise<GenreStat[]> {
  const where = buildWhere(userId, range)
  // Pas de `take` : les genres doivent agréger **tous** les artistes écoutés,
  // sinon les genres des artistes hors du top-100 (par écoutes) disparaissent et
  // le classement est faussé.
  const grouped = await prisma.play.groupBy({
    by: ['artistId'],
    where,
    _count: { artistId: true },
    _sum: { msPlayed: true },
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
    for (const genre of parseGenres(artist.genres)) {
      const current = totals.get(genre) ?? { plays: 0, msPlayed: 0 }
      current.plays += plays
      current.msPlayed += msPlayed
      totals.set(genre, current)
    }
  }

  return [...totals.entries()]
    .map(([genre, value]) => ({ genre, plays: value.plays, msPlayed: value.msPlayed }))
    .sort((a, b) => (metric === 'time' ? b.msPlayed - a.msPlayed : b.plays - a.plays))
    .slice(0, limit)
}

export type DailyStat = { day: string; msPlayed: number; plays: number }

/**
 * Agrégation temporelle en SQL par **tranches de 15 minutes UTC** : nombre de
 * lignes borné (jamais plus que le nombre d'écoutes) et surtout bien inférieur
 * quand l'écoute est dense.
 *
 * Le pas de 15 min garantit que le début de tranche tombe exactement sur la
 * frontière de jour/heure locale pour tous les fuseaux modernes (offsets
 * multiples de 15 min), y compris ceux à offset `:30`/`:45`.
 */
export type TimeBucket = { bucket: number; plays: number; msPlayed: number }

const BUCKET_SECONDS = 900

async function getTimeBuckets(
  userId: string,
  range: StatsRange,
): Promise<TimeBucket[]> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"userId" = ${userId}`,
    Prisma.sql`"counted" = true`,
  ]
  if (range.from) conditions.push(Prisma.sql`"playedAt" >= ${range.from}`)
  if (range.to) conditions.push(Prisma.sql`"playedAt" < ${range.to}`)
  if (!range.from && !range.to && range.days) {
    conditions.push(
      Prisma.sql`"playedAt" >= ${new Date(Date.now() - range.days * DAY_MS)}`,
    )
  }
  if (range.artistId) conditions.push(Prisma.sql`"artistId" = ${range.artistId}`)
  if (range.trackId) conditions.push(Prisma.sql`"trackId" = ${range.trackId}`)
  if (range.albumId) conditions.push(Prisma.sql`"albumId" = ${range.albumId}`)

  // `EXTRACT(EPOCH FROM "playedAt")` renvoie les secondes depuis l'époque Unix.
  // Le timestamp (sans fuseau) est interprété en UTC : c'est l'équivalent de
  // `strftime('%s', playedAt)` en SQLite. Le cast `::bigint` tronque les
  // secondes comme le faisait `CAST(... AS INTEGER)`.
  const rows = await prisma.$queryRaw<
    Array<{ bucket: number | bigint; plays: number | bigint; msPlayed: number | bigint }>
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
  )
  return rows.map((row) => ({
    bucket: Number(row.bucket),
    plays: Number(row.plays),
    msPlayed: Number(row.msPlayed),
  }))
}

/** Instant UTC du début d'une tranche (index de tranches de 15 min). */
function bucketDate(bucket: number): Date {
  return new Date(bucket * BUCKET_SECONDS * 1000)
}

export async function getDailyStats(
  userId: string,
  timeZone: string,
  range: StatsRange,
): Promise<DailyStat[]> {
  const buckets = await getTimeBuckets(userId, range)

  const daily = new Map<string, DailyStat>()

  // Jour de départ : début de fenêtre, ou premier jour d'écoute pour « tout ».
  let startMs = Date.now()
  if (range.from) {
    startMs = range.from.getTime()
  } else if (range.days) {
    startMs = Date.now() - range.days * DAY_MS
  } else if (buckets.length > 0) {
    startMs = bucketDate(buckets[0].bucket).getTime()
  }

  // Pré-remplit chaque jour (heure locale) afin d'avoir un graphe continu.
  const startDay = dayKey(new Date(startMs), timeZone)
  const endDay = dayKey(range.to ?? new Date(), timeZone)
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
    daily.set(key, { day: key, msPlayed: 0, plays: 0 })
  }

  for (const bucket of buckets) {
    const key = dayKey(bucketDate(bucket.bucket), timeZone)
    const stat = daily.get(key) ?? { day: key, msPlayed: 0, plays: 0 }
    stat.msPlayed += bucket.msPlayed
    stat.plays += bucket.plays
    daily.set(key, stat)
  }

  return [...daily.values()].sort((a, b) => a.day.localeCompare(b.day))
}

export type HourStat = { hour: number; plays: number; msPlayed: number }

export type HourlyStats = { hours: HourStat[]; activeDays: number }

export type TimelineStats = { daily: DailyStat[]; hourly: HourlyStats }

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
  const hourBuckets = await getTimeBuckets(userId, range)

  const daily = new Map<string, DailyStat>()
  let startMs = Date.now()
  if (range.from) {
    startMs = range.from.getTime()
  } else if (range.days) {
    startMs = Date.now() - range.days * DAY_MS
  } else if (hourBuckets.length > 0) {
    startMs = bucketDate(hourBuckets[0].bucket).getTime()
  }
  const startDay = dayKey(new Date(startMs), timeZone)
  const endDay = dayKey(range.to ?? new Date(), timeZone)
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
    daily.set(key, { day: key, msPlayed: 0, plays: 0 })
  }

  const hours: HourStat[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    plays: 0,
    msPlayed: 0,
  }))
  const activeDays = new Set<string>()

  for (const bucket of hourBuckets) {
    const date = bucketDate(bucket.bucket)
    const key = dayKey(date, timeZone)
    const stat = daily.get(key) ?? { day: key, msPlayed: 0, plays: 0 }
    stat.msPlayed += bucket.msPlayed
    stat.plays += bucket.plays
    daily.set(key, stat)

    const hour = hours[hourOf(date, timeZone)]
    hour.plays += bucket.plays
    hour.msPlayed += bucket.msPlayed
    activeDays.add(key)
  }

  return {
    daily: [...daily.values()].sort((a, b) => a.day.localeCompare(b.day)),
    hourly: { hours, activeDays: activeDays.size },
  }
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
  const [overview, topTracks, topAlbums, daily, recent] =
    await Promise.all([
      getOverview(userId, scoped),
      getTopTracks(userId, scoped, 10, 'time'),
      getTopAlbums(userId, scoped, 6, 'time'),
      getDailyStats(userId, timeZone, scoped),
      getRecentPlays(userId, scoped, 15),
    ])

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
  const [overview, daily, recent] = await Promise.all([
    getOverview(userId, scoped),
    getDailyStats(userId, timeZone, scoped),
    getRecentPlays(userId, scoped, 15),
  ])

  const genres = parseGenres(track.artist.genres)

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
      where: {
        name: { contains: q, mode: "insensitive" },
        plays: { some: { userId, counted: true } },
      },
      take: limit,
      orderBy: { name: 'asc' },
    }),
    prisma.track.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
        plays: { some: { userId, counted: true } },
      },
      take: limit,
      include: { artist: true, album: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const artistPlays = await prisma.play.groupBy({
    by: ['artistId'],
    where: { userId, counted: true, artistId: { in: artists.map((a) => a.id) } },
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
  const hourBuckets = await getTimeBuckets(userId, range)

  const daily = new Map<string, TimelineBucket>()
  const monthly = new Map<string, TimelineBucket>()
  const hours = new Array<number>(24).fill(0)

  for (const bucket of hourBuckets) {
    const date = bucketDate(bucket.bucket)
    // Clés en **UTC** : les périodes Wrapped sont des bornes UTC ; des clés
    // locales produisaient des tranches hors période (ex. un jour local basculant
    // sur le mois/année suivants) et un décalage avec `getOverview`.
    const dayKeyValue = date.toISOString().slice(0, 10)
    const monthKey = dayKeyValue.slice(0, 7)

    const day = daily.get(dayKeyValue) ?? { key: dayKeyValue, msPlayed: 0, plays: 0 }
    day.msPlayed += bucket.msPlayed
    day.plays += bucket.plays
    daily.set(dayKeyValue, day)

    const month = monthly.get(monthKey) ?? { key: monthKey, msPlayed: 0, plays: 0 }
    month.msPlayed += bucket.msPlayed
    month.plays += bucket.plays
    monthly.set(monthKey, month)

    hours[hourOf(date, timeZone)] += bucket.plays
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
}

/** Artistes écoutés pour la première fois pendant la période. */
export async function getDiscoveredArtists(
  userId: string,
  range: StatsRange,
  limit = 5,
): Promise<DiscoveredArtists> {
  if (!range.from) return { count: 0, artists: [] }

  const [before, inRange] = await Promise.all([
    prisma.play.groupBy({
      by: ['artistId'],
      where: { userId, counted: true, playedAt: { lt: range.from } },
    }),
    prisma.play.groupBy({
      by: ['artistId'],
      where: buildWhere(userId, range),
      _count: { artistId: true },
      _sum: { msPlayed: true },
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
          msPlayed: row._sum.msPlayed ?? 0,
          imageUrl: artist.imageUrl,
          genres: parseGenres(artist.genres),
        },
      ]
    }),
  }
}

/** Années pour lesquelles l'utilisateur possède des écoutes comptées (desc.). */
export async function getPlayingYears(userId: string): Promise<number[]> {
  const aggregate = await prisma.play.aggregate({
    where: { userId, counted: true },
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

/** Records sur tout l'historique : séries, jours actifs, jour le plus intense. */
export async function getRecords(
  userId: string,
  timeZone: string,
): Promise<ListeningRecords> {
  const daily = await getDailyStats(userId, timeZone, { days: null })
  return computeRecords(daily, dayKey(new Date(), timeZone))
}

