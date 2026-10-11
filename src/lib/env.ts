import 'server-only'

import pkg from '../../package.json'

/**
 * Accès centralisé aux variables d'environnement.
 *
 * Les secrets ne sont validés qu'au moment de leur utilisation afin que le
 * build Next.js puisse importer les modules sans exiger un `.env` complet.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Copiez .env.example vers .env.`,
    )
  }
  return value
}

export function getSessionSecret(): Uint8Array {
  return new TextEncoder().encode(required('SESSION_SECRET'))
}

export function getCredentialsKey(): Buffer {
  const raw = required('CREDENTIALS_KEY')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error(
      'CREDENTIALS_KEY doit contenir 32 octets encodés en base64 (openssl rand -base64 32).',
    )
  }
  return key
}

export const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Statisfy'

/** Version de l'application (lue depuis `package.json`). */
export const appVersion: string = pkg.version

/** URL publique de l'instance (pour les redirections derrière un proxy). */
export const appUrl = process.env.APP_URL || ''

/**
 * Domaine partagé des cookies (ex. `.keller-laurent.org`) pour que la session
 * et le cookie OAuth `state` soient lisibles sur plusieurs sous-domaines
 * (UI et endpoint de callback séparés).
 */
export const cookieDomain = process.env.COOKIE_DOMAIN || ''

export const databaseUrl = process.env.DATABASE_URL

export function allowRegistration(): boolean {
  return process.env.ALLOW_REGISTRATION !== 'false'
}

export const spotify = {
  clientId: process.env.SPOTIFY_CLIENT_ID || '',
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
  redirectUri:
    process.env.SPOTIFY_REDIRECT_URI ||
    'http://127.0.0.1:3000/api/sources/spotify/callback',
  get configured() {
    return Boolean(this.clientId && this.clientSecret)
  },
}

export const syncToken = process.env.SYNC_TOKEN || ''

/**
 * Intervalle minimal (ms) entre deux synchros déclenchées par `/api/sync`.
 * Permet d'appeler l'endpoint très souvent (cron) sans surcharger Spotify.
 */
export const syncMinIntervalMs =
  Number(process.env.SYNC_MIN_INTERVAL_MS) || 20 * 60 * 1000
