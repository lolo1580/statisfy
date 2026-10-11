import 'server-only'

import { prisma } from '../db'
import type { RawPlay } from '../sources/types'

export type IngestResult = {
  total: number
  inserted: number
  skipped: number
}

const CHUNK_SIZE = 400

/** Clé de déduplication stable par fournisseur, piste et horodatage. */
function buildDedupKey(play: RawPlay): string {
  const identity =
    play.externalTrackId ??
    `${play.artistName.trim().toLowerCase()}::${play.trackName.trim().toLowerCase()}`
  return `${play.provider}|${identity}|${play.playedAt.toISOString()}`
}

function mergeGenres(existing: string | null, incoming?: string[]): string | null {
  if (!incoming?.length) return existing
  const current: string[] = existing ? (JSON.parse(existing) as string[]) : []
  const merged = [...new Set([...current, ...incoming])]
  return JSON.stringify(merged)
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

  const artistByName = new Map<string, string>()
  const artistByExt = new Map<string, string>()
  const albumByKey = new Map<string, string>()
  const albumByExt = new Map<string, string>()
  const trackByKey = new Map<string, string>()
  const trackByExt = new Map<string, string>()

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
      record = await prisma.artist.create({
        data: {
          name,
          imageUrl: play.artistImageUrl ?? null,
          genres: play.genres?.length ? JSON.stringify(play.genres) : null,
        },
      })
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
      record = await prisma.album.create({
        data: {
          artistId,
          name: play.albumName,
          imageUrl: play.imageUrl ?? null,
        },
        select: { id: true, imageUrl: true },
      })
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
  ): Promise<string> {
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
        trackByExt.set(ext, ref.trackId)
        return ref.trackId
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
      select: { id: true },
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
        select: { id: true },
      })
    }
    trackByKey.set(key, record.id)
    if (ext) {
      await prisma.externalRef.upsert({
        where: { provider_externalId: { provider: play.provider, externalId: ext } },
        create: { provider: play.provider, externalId: ext, trackId: record.id },
        update: { trackId: record.id },
      })
      trackByExt.set(ext, record.id)
    }
    return record.id
  }

  const seen = new Set<string>()
  const rows: Array<{
    userId: string
    trackId: string
    artistId: string
    albumId: string | null
    playedAt: Date
    msPlayed: number
    source: string
    context: string | null
    dedupKey: string
  }> = []

  for (const play of plays) {
    if (!play.trackName?.trim() || !play.artistName?.trim()) continue
    const dedupKey = buildDedupKey(play)
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)

    const artistId = await resolveArtist(play)
    const albumId = await resolveAlbum(play, artistId)
    const trackId = await resolveTrack(play, artistId, albumId)

    rows.push({
      userId,
      trackId,
      artistId,
      albumId,
      playedAt: play.playedAt,
      msPlayed: Math.max(0, Math.round(play.msPlayed ?? play.durationMs ?? 0)),
      source: play.origin ?? play.provider,
      context: play.context ?? null,
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
    if (fresh.length > 0) {
      const result = await prisma.play.createMany({ data: fresh })
      inserted += result.count
    }
  }

  return { total: rows.length, inserted, skipped: rows.length - inserted }
}
