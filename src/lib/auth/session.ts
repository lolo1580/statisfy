import 'server-only'

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { prisma } from '../db'
import { cookieDomain, getSessionSecret } from '../env'

const COOKIE_NAME = 'statisfy_session'

const DAY_MS = 24 * 60 * 60 * 1000

function positiveIntEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

/** Durée de vie **absolue** d'une session (défaut 7 jours, `SESSION_TTL_DAYS`). */
const SESSION_DURATION_MS = positiveIntEnv('SESSION_TTL_DAYS', 7) * DAY_MS

/** Timeout d'**inactivité** (défaut 24 h, `SESSION_IDLE_HOURS`). */
const SESSION_IDLE_MS =
  positiveIntEnv('SESSION_IDLE_HOURS', 24) * 60 * 60 * 1000

/** Intervalle minimal entre deux rafraîchissements de `lastUsedAt`. */
const SESSION_TOUCH_MS = 5 * 60 * 1000

export type SessionPayload = { uid: string; sid: string }

async function sign(payload: SessionPayload, expiresAt: Date): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSessionSecret())
}

async function verify(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ['HS256'],
    })
    if (typeof payload.uid !== 'string' || typeof payload.sid !== 'string') {
      return null
    }
    return { uid: payload.uid, sid: payload.sid }
  } catch {
    return null
  }
}

/** Crée une session en base, pose le cookie signé. */
export async function createSession(userId: string): Promise<void> {
  // Purge opportuniste des sessions expirées (best-effort, à la connexion).
  await prisma.session
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => undefined)
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  const session = await prisma.session.create({
    data: { userId, expiresAt },
  })
  const token = await sign({ uid: userId, sid: session.id }, expiresAt)
  const jar = await cookies()
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  })
}

/**
 * Vérifie le cookie et confirme que la session existe toujours en base
 * (permet de révoquer une session côté serveur), qu'elle n'est ni expirée ni
 * inactive depuis trop longtemps. Rafraîchit l'activité (throttlé).
 */
export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies()
  const payload = await verify(jar.get(COOKIE_NAME)?.value)
  if (!payload) return null

  const row = await prisma.session.findUnique({ where: { id: payload.sid } })
  if (!row || row.userId !== payload.uid) return null

  const now = Date.now()
  if (
    row.expiresAt.getTime() < now ||
    now - row.lastUsedAt.getTime() > SESSION_IDLE_MS
  ) {
    // Expirée ou inactive : on nettoie la session.
    await prisma.session
      .deleteMany({ where: { id: row.id } })
      .catch(() => undefined)
    return null
  }

  // Rafraîchit l'horodatage d'activité au plus toutes les 5 minutes.
  if (now - row.lastUsedAt.getTime() > SESSION_TOUCH_MS) {
    await prisma.session
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date(now) } })
      .catch(() => undefined)
  }

  return payload
}

export async function deleteSession(): Promise<void> {
  const jar = await cookies()
  const payload = await verify(jar.get(COOKIE_NAME)?.value)
  if (payload) {
    await prisma.session.deleteMany({ where: { id: payload.sid } })
  }
  if (cookieDomain) {
    // Un cookie posé avec un domaine doit être supprimé avec ce même domaine.
    jar.set(COOKIE_NAME, '', {
      path: '/',
      domain: cookieDomain,
      maxAge: 0,
      expires: new Date(0),
    })
  } else {
    jar.delete(COOKIE_NAME)
  }
}
