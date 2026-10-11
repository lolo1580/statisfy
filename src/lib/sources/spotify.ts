import 'server-only'

import type { RawPlay, SourceAdapter, SyncContext } from './types'
import { spotify } from '../env'
import { spotifyFetch, spotifyErrorMessage } from './spotify-http'

const ACCOUNTS = 'https://accounts.spotify.com'
const API = 'https://api.spotify.com/v1'

// Scopes minimaux : la synchronisation n'utilise que les écoutes récentes.
export const SPOTIFY_SCOPES = ['user-read-recently-played'].join(' ')

type SpotifyCredentials = {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
}

type SpotifyArtist = { id: string; name: string; genres?: string[] }
type SpotifyImage = { url: string }
type SpotifyTrack = {
  id: string
  name: string
  duration_ms?: number
  artists: SpotifyArtist[]
  album?: { id?: string; name?: string; images?: SpotifyImage[]; release_date?: string }
}
type RecentlyPlayedItem = {
  track: SpotifyTrack
  played_at: string
  context?: { type?: string; uri?: string }
}

export function buildSpotifyAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: spotify.clientId,
    scope: SPOTIFY_SCOPES,
    redirect_uri: spotify.redirectUri,
    state,
  })
  return `${ACCOUNTS}/authorize?${params.toString()}`
}

export async function exchangeSpotifyCode(code: string): Promise<SpotifyCredentials> {
  const basic = Buffer.from(`${spotify.clientId}:${spotify.clientSecret}`).toString(
    'base64',
  )
  const res = await spotifyFetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: spotify.redirectUri,
    }),
  })
  if (!res.ok) {
    throw new Error(
      `Échange de code Spotify échoué : ${await spotifyErrorMessage(res)}.`,
    )
  }
  const data = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}

/** Rafraîchit le token si nécessaire. Mute l'objet credentials fourni. */
async function ensureToken(creds: SpotifyCredentials): Promise<string> {
  if (creds.accessToken && creds.expiresAt && creds.expiresAt > Date.now() + 60_000) {
    return creds.accessToken
  }
  if (!creds.refreshToken) {
    throw new Error('Session Spotify expirée : reconnectez le compte.')
  }
  const basic = Buffer.from(`${spotify.clientId}:${spotify.clientSecret}`).toString(
    'base64',
  )
  const res = await spotifyFetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: creds.refreshToken,
    }),
  })
  if (!res.ok) {
    throw new Error(
      `Rafraîchissement du token Spotify échoué : ${await spotifyErrorMessage(res)}.`,
    )
  }
  const data = (await res.json()) as {
    access_token: string
    expires_in: number
    refresh_token?: string
  }
  creds.accessToken = data.access_token
  creds.expiresAt = Date.now() + data.expires_in * 1000
  if (data.refresh_token) creds.refreshToken = data.refresh_token
  return data.access_token
}

async function fetchArtistGenres(
  token: string,
  artistIds: string[],
): Promise<Map<string, { name: string; genres: string[]; image?: string }>> {
  const result = new Map<string, { name: string; genres: string[]; image?: string }>()
  const unique = [...new Set(artistIds)].filter(Boolean)
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50)
    const res = await spotifyFetch(`${API}/artists?ids=${batch.join(',')}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) continue
    const data = (await res.json()) as {
      artists: Array<{ id: string; name: string; genres: string[]; images?: SpotifyImage[] }>
    }
    for (const artist of data.artists ?? []) {
      result.set(artist.id, {
        name: artist.name,
        genres: artist.genres ?? [],
        image: artist.images?.[0]?.url,
      })
    }
  }
  return result
}

export const spotifyAdapter: SourceAdapter = {
  type: 'spotify',
  label: 'Spotify',

  async fetchPlays(ctx: SyncContext): Promise<RawPlay[]> {
    if (!spotify.configured) {
      throw new Error(
        'SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET non configurés sur le serveur.',
      )
    }
    const creds = ctx.credentials as SpotifyCredentials
    const token = await ensureToken(creds)

    const url = new URL(`${API}/me/player/recently-played`)
    url.searchParams.set('limit', '50')
    // L'API ne remonte que les 50 derniers morceaux ; `after` affine si récent.
    if (ctx.since && Date.now() - ctx.since.getTime() < 24 * 60 * 60 * 1000) {
      url.searchParams.set('after', String(ctx.since.getTime()))
    }

    const res = await spotifyFetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      throw new Error(
        `Spotify a répondu : ${await spotifyErrorMessage(res)}.`,
      )
    }
    const data = (await res.json()) as { items?: RecentlyPlayedItem[] }
    const items = data.items ?? []
    if (items.length === 0) return []

    // Enrichissement des genres (un seul appel groupé, pas de N+1).
    const artistIds = items.flatMap((it) => it.track.artists.map((a) => a.id))
    let genres = new Map<string, { name: string; genres: string[]; image?: string }>()
    try {
      genres = await fetchArtistGenres(token, artistIds)
    } catch {
      // L'enrichissement est optionnel : on continue sans les genres.
    }

    const plays: RawPlay[] = []
    for (const item of items) {
      const t = item.track
      const primary = t.artists[0]
      if (!primary) continue
      const playedAt = new Date(item.played_at)
      if (Number.isNaN(playedAt.getTime())) continue
      plays.push({
        provider: 'spotify',
        externalTrackId: t.id,
        externalArtistId: primary.id,
        externalAlbumId: t.album?.id,
        trackName: t.name,
        artistName: primary.name,
        albumName: t.album?.name,
        durationMs: t.duration_ms,
        imageUrl: t.album?.images?.[0]?.url,
        artistImageUrl: genres.get(primary.id)?.image,
        genres: genres.get(primary.id)?.genres ?? undefined,
        playedAt,
        msPlayed: t.duration_ms,
        context: item.context?.type,
      })
    }
    return plays
  },
}
