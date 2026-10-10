import 'server-only'

import { SignJWT, jwtVerify } from 'jose'
import { headers } from 'next/headers'
import { getSessionSecret } from '../env'

/**
 * État OAuth signé.
 *
 * Contrairement à un cookie, un jeton signé est vérifiable par n'importe quel
 * hôte : on peut donc lancer l'OAuth depuis `localhost` (dev) et recevoir le
 * callback sur un domaine public, sans partager de cookie entre les deux.
 *
 * - `uid` : l'utilisateur qui a initié la connexion.
 * - `ret` : l'URL de l'interface vers laquelle rediriger après le callback.
 */
export type OAuthState = {
  uid: string
  ret?: string
}

const PURPOSE = 'spotify_oauth'

export async function signOAuthState(state: OAuthState): Promise<string> {
  return new SignJWT({ ...state, purpose: PURPOSE })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(getSessionSecret())
}

export async function verifyOAuthState(
  token: string | null | undefined,
): Promise<OAuthState | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ['HS256'],
    })
    if (payload.purpose !== PURPOSE || typeof payload.uid !== 'string') {
      return null
    }
    return {
      uid: payload.uid,
      ret: typeof payload.ret === 'string' ? payload.ret : undefined,
    }
  } catch {
    return null
  }
}

/** Origine publique de la requête (derrière un proxy si en-têtes transmis). */
export async function requestOrigin(): Promise<string | null> {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
  if (!host) return null
  const proto = headerList.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

/** Nettoie une origine : conserve le schéma http/https, retire le slash final. */
export function normalizeOrigin(origin: string | null | undefined): string | null {
  if (!origin) return null
  if (!/^https?:\/\//.test(origin)) return null
  return origin.replace(/\/+$/, '')
}
