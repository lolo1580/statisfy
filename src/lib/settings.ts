import 'server-only'

import { prisma } from './db'
import { allowRegistration as envAllowRegistration } from './env'
import { MIN_LISTEN_RATIO, safeListenRatio } from './play-counting'

export const SETTING_ALLOW_REGISTRATION = 'allow_registration'
export const SETTING_MIN_LISTEN_RATIO = 'min_listen_ratio'

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } })
  return row?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}

/** Les inscriptions sont autorisées par défaut, sauf si désactivées (env ou UI). */
export async function registrationAllowed(): Promise<boolean> {
  const stored = await getSetting(SETTING_ALLOW_REGISTRATION)
  if (stored === null) return envAllowRegistration()
  return stored === 'true'
}

/** Seuil de comptabilisation d'une écoute (0–1). Défaut : 3/4. */
export async function getMinListenRatio(): Promise<number> {
  const stored = await getSetting(SETTING_MIN_LISTEN_RATIO)
  if (stored === null) return MIN_LISTEN_RATIO
  const value = Number(stored)
  return safeListenRatio(value)
}
