import 'server-only'

import crypto from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

const KEY_LENGTH = 64

/** Hache un mot de passe avec scrypt + sel aléatoire. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16)
  const derived = await scrypt(password, salt, KEY_LENGTH)
  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`
}

/** Vérifie un mot de passe en temps constant. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split('$')
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false
  const salt = Buffer.from(saltB64, 'base64')
  const expected = Buffer.from(hashB64, 'base64')
  const derived = await scrypt(password, salt, expected.length)
  if (derived.length !== expected.length) return false
  return crypto.timingSafeEqual(derived, expected)
}

/**
 * Hash scrypt factice (coût de calcul identique) : vérifie un mot de passe sans
 * révéler l'existence du compte par le **temps de réponse** (email inconnu).
 */
const DUMMY_PASSWORD_HASH = `scrypt$${Buffer.alloc(16, 7).toString('base64')}$${Buffer.alloc(64, 3).toString('base64')}`

/** Vérifie `stored` s'il existe, sinon un hash factice (coût identique). */
export function verifyPasswordOrDummy(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  return verifyPassword(password, stored ?? DUMMY_PASSWORD_HASH)
}
