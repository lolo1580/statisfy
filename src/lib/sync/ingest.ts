import 'server-only'

import { prisma } from '../db'
import { isPlayCounted } from '../play-counting'
import { getMinListenRatio } from '../settings'
import type { RawPlay } from '../sources/types'
import { buildDedupKey } from './dedup'

/** Piste résolue : identifiant + durée (pour la règle des 3/4). */
type TrackRef = { id: string; durationMs: number | null }

export type IngestResult = {
  total: number
  inserted: number
  skipped: number
}

const CHUNK_SIZE = 400

function mergeGenres(existing: string | null, incoming?: string[]): string | null {
  if (!incoming?.length) return existing
  let current: string[] = []
  if (existing) {
    try {
      const parsed = JSON.parse(existing)
      if (Array.isArray(parsed)) current = parsed.filter((g): g is string => typeof g === "string")
    } catch {
      current = []
    }
  }
  const merged = [...new Set([...current, ...incoming])]
  return JSON.stringify(merged)
}

/** Violation de contrainte unique Prisma (P2002). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  )
}

/**
 * Insère un lot d'écoutes en résolvant les entités artiste/album/piste.
 * Idempotent : les écoutes déjà présentes (même clé de déduplication) sont
 * ignorées.
 */
export async function ingestPlays(
  userId: string,
  plays: RawPlay[],
): Promise<IngestResult> {
  if (plays.length === 0) return { total: 0, inserted: 0, skipped: 0 }

  const ratio = await getMinListenRatio()

  const artistByName = new Map<string, string>()
  const artistByExt = new Map<string, string>()
  const albumByKey = new Map<string, string>()
  const albumByExt = new Map<string, string>()
  const trackByKey = new Map<string, TrackRef>()
  const trackByExt = new Map<string, TrackRef>()

  async function resolveArtist(play: RawPlay): Promise<string> {
    const ext = play.externalArtistId
    if (ext) {
      const cached = artistByExt.get(ext)
      if (cached) return cached
      const ref = await prisma.externalRef.findUnique({
        where: {
          provider_externalId: { provider: play.provider, externalId: ext },
        },
        select: { artistId: true },
      })
      if (ref?.artistId) {
        artistByExt.set(ext, ref.artistId)
        return ref.artistId
      }
    }

    const name = play.artistName
    const cached = artistByName.get(name)
    if (cached) {
      if (ext) artistByExt.set(ext, cached)
      return cached
    }

    let record = await prisma.artist.findUnique({ where: { name } })
    if (!record) {
      try {
        record = await prisma.artist.create({
          data: {
            name,
            imageUrl: play.artistImageUrl ?? null,
            genres: play.genres?.length
              ? JSON.stringify([...new Set(play.genres)])
              : null,
          },
        })
      } catch (error) {
        // Course avec une autre synchro/import sur le même artiste : on relit
        // l'entité créée par l'autre transaction au lieu d'avorter le lot.
        if (!isUniqueViolation(error)) throw error
        record = await prisma.artist.findUnique({ where: { name } })
        if (!record) throw error
      }
    } else if (play.genres?.length || (play.artistImageUrl && !record.imageUrl)) {
      record = await prisma.artist.update({
        where: { id: record.id },
        data: {
          genres: mergeGenres(record.genres, play.genres) ?? record.genres,
          imageUrl: record.imageUrl ?? play.artistImageUrl ?? null,
        },
      })
    }

    artistByName.set(name, record.id)
    if (ext) {
      await prisma.externalRef.upsert({
        where: { provider_externalId: { provider: play.provider, externalId: ext } },
        create: { provider: play.provider, externalId: ext, artistId: record.id },
        update: { artistId: record.id },
      })
      artistByExt.set(ext, record.id)
    }
    return record.id
  }

  async function resolveAlbum(
    play: RawPlay,
    artistId: string,
  ): Promise<string | null> {
    if (!play.albumName) return null
    const ext = play.externalAlbumId
    if (ext) {
      const cached = albumByExt.get(ext)
      if (cached) return cached
      const ref = await prisma.externalRef.findUnique({
        where: {
          provider_externalId: { provider: play.provider, externalId: ext },
        },
        select: { albumId: true },
      })
      if (ref?.albumId) {
        albumByExt.set(ext, ref.albumId)
        return ref.albumId
      }
    }

    const key = `${artistId}|${play.albumName}`
    const cached = albumByKey.get(key)
    if (cached) {
      if (ext) albumByExt.set(ext, cached)
      return cached
    }

    let record = await prisma.album.findUnique({
      where: { artistId_name: { artistId, name: play.albumName } },
      select: { id: true, imageUrl: true },
    })
    if (!record) {
      try {
        record = await prisma.album.create({
          data: {
            artistId,
            name: play.albumName,
            imageUrl: play.imageUrl ?? null,
          },
          select: { id: true, imageUrl: true },
        })
      } catch (error) {
        // Course sur l'unicité (artistId, name) : on relit l'album existant.
        if (!isUniqueViolation(error)) throw error
        record = await prisma.album.findUnique({
          where: { artistId_name: { artistId, name: play.albumName } },
          select: { id: true, imageUrl: true },
        })
        if (!record) throw error
      }
    }
    albumByKey.set(key, record.id)
    if (ext) {
      await prisma.externalRef.upsert({
        where: { provider_externalId: { provider: play.provider, externalId: ext } },
        create: { provider: play.provider, externalId: ext, albumId: record.id },
        update: { albumId: record.id },
      })
      albumByExt.set(ext, record.id)
    }
    return record.id
  }

  async function resolveTrack(
    play: RawPlay,
    artistId: string,
    albumId: string | null,
  ): Promise<TrackRef> {
    const ext = play.externalTrackId
    if (ext) {
      const cached = trackByExt.get(ext)
      if (cached) return cached
      const ref = await prisma.externalRef.findUnique({
        where: {
          provider_externalId: { provider: play.provider, externalId: ext },
        },
        select: { trackId: true },
      })
      if (ref?.trackId) {
        const existing = await prisma.track.findUnique({
          where: { id: ref.trackId },
          select: { durationMs: true },
        })
        const value: TrackRef = {
          id: ref.trackId,
          durationMs: existing?.durationMs ?? null,
        }
        trackByExt.set(ext, value)
        return value
      }
    }

    const key = `${artistId}|${albumId ?? ""}|${play.trackName}`
    const cached = trackByKey.get(key)
    if (cached) {
      if (ext) trackByExt.set(ext, cached)
      return cached
    }

    let record = await prisma.track.findFirst({
      where: { artistId, name: play.trackName, albumId: albumId ?? null },
      select: { id: true, durationMs: true },
    })
    if (!record) {
      record = await prisma.track.create({
        data: {
          artistId,
          albumId,
          name: play.trackName,
          durationMs: play.durationMs ?? null,
          imageUrl: play.imageUrl ?? null,
          isrc: play.isrc ?? null,
        },
        select: { id: true, durationMs: true },
      })
    }
    const value: TrackRef = { id: record.id, durationMs: record.durationMs }
    trackByKey.set(key, value)
    if (ext) {
      await prisma.externalRef.upsert({
        where: { provider_externalId: { provider: play.provider, externalId: ext } },
        create: { provider: play.provider, externalId: ext, trackId: record.id },
        update: { trackId: record.id },
      })
      trackByExt.set(ext, value)
    }
    return value
  }

  const seen = new Set<string>()

  // Préchargement des entités existantes (ids externes, albums, pistes) pour
  // éviter une requête par entité distincte (N+1). Les artistes ne sont
  // volontairement pas préchargés : leur résolution peut enrichir genres/image.
  const distinct = (values: Array<string | undefined>): string[] => [
    ...new Set(values.filter((v): v is string => Boolean(v))),
  ]
  const extIds = distinct(
    plays.flatMap((p) => [p.externalArtistId, p.externalAlbumId, p.externalTrackId]),
  )
  const albumNames = distinct(plays.map((p) => p.albumName?.trim()))
  const trackNames = distinct(plays.map((p) => p.trackName?.trim()))

  if (extIds.length > 0) {
    const refs = await prisma.externalRef.findMany({
      where: { externalId: { in: extIds } },
      select: { externalId: true, artistId: true, albumId: true, trackId: true },
    })
    const refTrackIds = distinct(refs.map((r) => r.trackId ?? undefined))
    const refTracks =
      refTrackIds.length > 0
        ? await prisma.track.findMany({
            where: { id: { in: refTrackIds } },
            select: { id: true, durationMs: true },
          })
        : []
    const durationByTrackId = new Map(refTracks.map((t) => [t.id, t.durationMs]))
    for (const ref of refs) {
      if (ref.artistId) artistByExt.set(ref.externalId, ref.artistId)
      if (ref.albumId) albumByExt.set(ref.externalId, ref.albumId)
      if (ref.trackId) {
        trackByExt.set(ref.externalId, {
          id: ref.trackId,
          durationMs: durationByTrackId.get(ref.trackId) ?? null,
        })
      }
    }
  }
  if (albumNames.length > 0) {
    const albums = await prisma.album.findMany({
      where: { name: { in: albumNames } },
      select: { id: true, artistId: true, name: true },
    })
    for (const album of albums) albumByKey.set(`${album.artistId}|${album.name}`, album.id)
  }
  if (trackNames.length > 0) {
    const tracks = await prisma.track.findMany({
      where: { name: { in: trackNames } },
      select: { id: true, artistId: true, albumId: true, name: true, durationMs: true },
    })
    for (const track of tracks) {
      trackByKey.set(`${track.artistId}|${track.albumId ?? ""}|${track.name}`, {
        id: track.id,
        durationMs: track.durationMs,
      })
    }
  }

  const rows: Array<{
    userId: string
    trackId: string
    artistId: string
    albumId: string | null
    playedAt: Date
    msPlayed: number
    counted: boolean
    source: string
    context: string | null
    platform: string | null
    country: string | null
    skipped: boolean | null
    shuffle: boolean | null
    offline: boolean | null
    incognito: boolean | null
    reasonStart: string | null
    reasonEnd: string | null
    dedupKey: string
  }> = []

  for (const raw of plays) {
    const trackName = raw.trackName?.trim()
    const artistName = raw.artistName?.trim()
    if (!trackName || !artistName) continue
    // Normalise une fois pour toutes : la clé de dédup et la résolution des
    // entités utilisent alors exactement les mêmes valeurs (évite de créer des
    // artistes/pistes « fantômes » à cause d'espaces parasites).
    const play: RawPlay = {
      ...raw,
      artistName,
      trackName,
      albumName: raw.albumName?.trim() || undefined,
    }
    const dedupKey = buildDedupKey(play)
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)

    const artistId = await resolveArtist(play)
    const albumId = await resolveAlbum(play, artistId)
    const track = await resolveTrack(play, artistId, albumId)

    const msPlayed = Math.max(0, Math.round(play.msPlayed ?? play.durationMs ?? 0))
    const durationMs = play.durationMs ?? track.durationMs ?? null

    rows.push({
      userId,
      trackId: track.id,
      artistId,
      albumId,
      playedAt: play.playedAt,
      msPlayed,
      counted: isPlayCounted(msPlayed, durationMs, ratio),
      source: play.origin ?? play.provider,
      context: play.context ?? null,
      platform: play.platform ?? null,
      country: play.country ?? null,
      skipped: play.skipped ?? null,
      shuffle: play.shuffle ?? null,
      offline: play.offline ?? null,
      incognito: play.incognito ?? null,
      reasonStart: play.reasonStart ?? null,
      reasonEnd: play.reasonEnd ?? null,
      dedupKey,
    })
  }

  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    const keys = chunk.map((r) => r.dedupKey)
    const existing = await prisma.play.findMany({
      where: { userId, dedupKey: { in: keys } },
      select: { dedupKey: true },
    })
    const existingKeys = new Set(existing.map((e) => e.dedupKey))
    const fresh = chunk.filter((r) => !existingKeys.has(r.dedupKey))
    if (fresh.length === 0) continue
    try {
      const result = await prisma.play.createMany({ data: fresh })
      inserted += result.count
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      // Course avec une autre synchro/import : on insère ligne par ligne en
      // ignorant les doublons déjà créés (idempotent) plutôt que d'avorter.
      for (const row of fresh) {
        try {
          await prisma.play.create({ data: row })
          inserted += 1
        } catch (rowError) {
          if (!isUniqueViolation(rowError)) throw rowError
        }
      }
    }
  }

  return { total: rows.length, inserted, skipped: rows.length - inserted }
}
