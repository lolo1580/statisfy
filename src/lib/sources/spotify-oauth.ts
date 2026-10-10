import 'server-only'

import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '../db'
import { encryptJson } from '../crypto'
import { appUrl, cookieDomain } from '../env'
import { exchangeSpotifyCode } from './spotify'
import {
  normalizeOrigin,
  requestOrigin,
  verifyOAuthState,
} from './spotify-state'

const STATE_COOKIE = 'spotify_oauth_state'

function clearStateCookie(jar: Awaited<ReturnType<typeof cookies>>) {
  if (cookieDomain) {
    jar.set(STATE_COOKIE, '', {
      path: '/',
      domain: cookieDomain,
      maxAge: 0,
      expires: new Date(0),
    })
  } else {
    jar.delete(STATE_COOKIE)
  }
}

/**
 * Traitement du retour OAuth Spotify, partagé par plusieurs chemins
 * (`/oauth/spotify/callback` et `/api/sources/spotify/callback`).
 *
 * L'utilisateur et l'URL de retour proviennent de l'état signé, ce qui rend le
 * callback indépendant de l'hôte et du cookie de session.
 */
export async function handleSpotifyCallback(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const rawState = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  const jar = await cookies()
  const cookieState = jar.get(STATE_COOKIE)?.value
  clearStateCookie(jar)

  const state = await verifyOAuthState(rawState)
  const fallback =
    normalizeOrigin(appUrl) ??
    normalizeOrigin(await requestOrigin()) ??
    new URL(request.url).origin
  const base = normalizeOrigin(state?.ret) ?? fallback
  const back = (query: string) => NextResponse.redirect(`${base}/settings${query}`)

  if (oauthError) return back('?error=spotify_denied')
  if (!state || !code) return back('?error=spotify_state')

  // Liaison au navigateur quand le cookie est disponible (même hôte).
  if (cookieState && cookieState !== rawState) return back('?error=spotify_state')

  try {
    const credentials = await exchangeSpotifyCode(code)

    const profileRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
      cache: 'no-store',
    })
    const profile = profileRes.ok
      ? ((await profileRes.json()) as { id?: string; display_name?: string })
      : {}

    const displayName = `Spotify · ${profile.display_name || profile.id || 'compte'}`

    await prisma.sourceConnection.upsert({
      where: {
        userId_type_displayName: {
          userId: state.uid,
          type: 'spotify',
          displayName,
        },
      },
      create: {
        userId: state.uid,
        type: 'spotify',
        displayName,
        credentials: encryptJson(credentials),
        config: JSON.stringify({}),
      },
      update: {
        credentials: encryptJson(credentials),
        status: 'active',
        lastError: null,
      },
    })

    return back('?ok=spotify')
  } catch {
    return back('?error=spotify_exchange')
  }
}
