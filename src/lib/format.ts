/** Utilitaires d'affichage et de gestion du temps. */

export function formatDuration(ms: number): string {
  if (!ms || ms < 0) return '0 min'
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${String(minutes).padStart(2, '0')}`
}

export function formatDurationLong(ms: number): string {
  if (!ms || ms < 0) return '0 minute'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const parts: string[] = []
  if (hours) parts.push(`${hours} h`)
  if (minutes || !hours) parts.push(`${minutes} min`)
  return parts.join(' ')
}

export function formatNumber(value: number, locale: string = "en"): string {
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * Décalage (ms) d'un fuseau IANA par rapport à UTC à un instant donné.
 * Positif à l'est de Greenwich.
 */
export function getTimezoneOffsetMs(timeZone: string, at: Date = new Date()): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    const parts = formatter.formatToParts(at)
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
    const asUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second'),
    )
    return asUtc - at.getTime()
  } catch {
    return 0
  }
}

/** Clé de jour locale « YYYY-MM-DD » pour un instant donné. */
export function dayKey(date: Date, timeZone: string, offsetMs?: number): string {
  const offset = offsetMs ?? getTimezoneOffsetMs(timeZone, date)
  return new Date(date.getTime() + offset).toISOString().slice(0, 10)
}

/** Heure locale (0-23). */
export function hourOf(date: Date, timeZone: string, offsetMs?: number): number {
  const offset = offsetMs ?? getTimezoneOffsetMs(timeZone, date)
  return new Date(date.getTime() + offset).getUTCHours()
}

/** Début du jour local (minuit dans le fuseau donné). */
export function startOfLocalDay(timeZone: string, now: Date = new Date()): Date {
  const offset = getTimezoneOffsetMs(timeZone, now)
  const local = new Date(now.getTime() + offset)
  local.setUTCHours(0, 0, 0, 0)
  return new Date(local.getTime() - offset)
}

/** Début de la semaine locale (lundi). */
export function startOfLocalWeek(timeZone: string, now: Date = new Date()): Date {
  const day = startOfLocalDay(timeZone, now)
  const offset = getTimezoneOffsetMs(timeZone, day)
  const dow = new Date(day.getTime() + offset).getUTCDay() // 0 = dimanche
  const daysSinceMonday = (dow + 6) % 7
  return new Date(day.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000)
}

/** Début du mois local (le 1er à minuit). */
export function startOfLocalMonth(timeZone: string, now: Date = new Date()): Date {
  const offset = getTimezoneOffsetMs(timeZone, now)
  const local = new Date(now.getTime() + offset)
  local.setUTCDate(1)
  local.setUTCHours(0, 0, 0, 0)
  return new Date(local.getTime() - offset)
}

export function formatDateTime(
  date: Date,
  timeZone: string,
  locale: string = "en",
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

export function formatDate(
  date: Date,
  timeZone: string,
  locale: string = "en",
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone,
  }).format(date);
}
