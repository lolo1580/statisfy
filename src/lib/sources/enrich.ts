import 'server-only'

import { prisma } from '../db'

/**
 * Enrichissement des pochettes et photos d'artistes.
 *
 * Les imports de fichiers Spotify ne contiennent aucune image. On complète
 * donc les entités manquantes via l'API publique Deezer (aucune clé requise,
 * `cover_xl` / `picture_xl`).
 */

const DEEZER = 'https://api.deezer.com'
const USER_AGENT = 'Statisfy/0.1 (self-hosted)'

type DeezerList<T> = { data?: T[] }
type DeezerAlbum = { cover_xl?: string; cover_big?: string; cover_medium?: string }
type DeezerArtist = {
  picture_xl?: string
  picture_big?: string
  picture_medium?: string
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Recherche la pochette d'un album sur Deezer. */
export async function findAlbumCover(
  artistName: string,
  albumName: string,
): Promise<string | null> {
  const query = `artist:"${artistName}" album:"${albumName}"`
  const data = await fetchJson<DeezerList<DeezerAlbum>>(
    `${DEEZER}/search/album?q=${encodeURIComponent(query)}&limit=1`,
  )
  const item = data?.data?.[0]
  return item?.cover_xl ?? item?.cover_big ?? item?.cover_medium ?? null
}

/** Recherche la photo d'un artiste sur Deezer. */
export async function findArtistPicture(name: string): Promise<string | null> {
  const data = await fetchJson<DeezerList<DeezerArtist>>(
    `${DEEZER}/search/artist?q=${encodeURIComponent(name)}&limit=1`,
  )
  const item = data?.data?.[0]
  return item?.picture_xl ?? item?.picture_big ?? item?.picture_medium ?? null
}

export type EnrichResult = {
  artistsChecked: number
  artistsUpdated: number
  albumsChecked: number
  albumsUpdated: number
}

/**
 * Complète les images manquantes des artistes et albums écoutés par
 * l'utilisateur. Les appels sont séquentiels et espacés pour respecter les
 * limites de Deezer.
 */
export async function enrichMissingImages(
  userId: string,
  options: { max?: number; delayMs?: number } = {},
): Promise<EnrichResult> {
  const max = options.max ?? 100
  const delayMs = options.delayMs ?? 120

  const [artists, albums] = await Promise.all([
    prisma.artist.findMany({
      where: { imageUrl: null, plays: { some: { userId } } },
      orderBy: { name: 'asc' },
      take: max,
    }),
    prisma.album.findMany({
      where: { imageUrl: null, plays: { some: { userId } } },
      orderBy: { name: 'asc' },
      take: max,
      include: { artist: { select: { name: true } } },
    }),
  ])

  let artistsUpdated = 0
  for (const artist of artists) {
    const url = await findArtistPicture(artist.name)
    if (url) {
      await prisma.artist.update({
        where: { id: artist.id },
        data: { imageUrl: url },
      })
      artistsUpdated += 1
    }
    await sleep(delayMs)
  }

  let albumsUpdated = 0
  for (const album of albums) {
    const url = await findAlbumCover(album.artist.name, album.name)
    if (url) {
      await prisma.album.update({
        where: { id: album.id },
        data: { imageUrl: url },
      })
      albumsUpdated += 1
    }
    await sleep(delayMs)
  }

  return {
    artistsChecked: artists.length,
    artistsUpdated,
    albumsChecked: albums.length,
    albumsUpdated,
  }
}
