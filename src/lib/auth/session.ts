import 'server-only'

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { prisma } from '../db'
import { cookieDomain, getSessionSecret } from '../env'

const COOKIE_NAME = 'statisfy_session'
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 jours

export type SessionPayload = { uid: string; sid: string }

async function sign(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
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
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  const session = await prisma.session.create({
    data: { userId, expiresAt },
  })
  const token = await sign({ uid: userId, sid: session.id })
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
 * (permet de révoquer une session côté serveur).
 */
export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies()
  const payload = await verify(jar.get(COOKIE_NAME)?.value)
  if (!payload) return null

  const row = await prisma.session.findUnique({ where: { id: payload.sid } })
  if (!row || row.expiresAt < new Date()) return null

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
