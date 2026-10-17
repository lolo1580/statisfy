/**
 * Calcul pur des records d'écoute : séries de jours consécutifs, jours actifs et
 * journée la plus intense. Séparé de la base pour être testable facilement.
 */

export type RecordDay = { day: string; msPlayed: number; plays: number }

export type ListeningRecords = {
  /** Jours d'affilée avec au moins une écoute, jusqu'à aujourd'hui (ou hier). */
  currentStreak: number
  /** Plus longue série de jours consécutifs, sur tout l'historique. */
  longestStreak: number
  /** Nombre de jours distincts avec au moins une écoute. */
  activeDays: number
  /** Jour le plus intense (temps d'écoute). */
  busiestDay: { day: string; msPlayed: number } | null
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Veille d'une clé « YYYY-MM-DD ». */
function previousDay(key: string): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) - DAY_MS)
    .toISOString()
    .slice(0, 10)
}

export function computeRecords(days: RecordDay[], todayKey: string): ListeningRecords {
  // Seuls les jours réellement actifs comptent : une série s'interrompt dès un
  // jour (calendaire) sans écoute.
  const active = [
    ...new Set(days.filter((d) => d.plays > 0).map((d) => d.day)),
  ].sort()

  let longestStreak = 0
  let run = 0
  let previous: string | null = null
  for (const day of active) {
    run = previous !== null && previousDay(day) === previous ? run + 1 : 1
    previous = day
    if (run > longestStreak) longestStreak = run
  }

  // Série en cours : on part d'aujourd'hui, ou d'hier si rien aujourd'hui (la
  // journée n'est peut-être pas terminée), puis on remonte tant que les jours
  // sont consécutifs.
  const activeSet = new Set(active)
  let cursor = activeSet.has(todayKey) ? todayKey : previousDay(todayKey)
  let currentStreak = 0
  while (activeSet.has(cursor)) {
    currentStreak += 1
    cursor = previousDay(cursor)
  }

  const busiestDay = days.reduce<{ day: string; msPlayed: number } | null>(
    (max, day) =>
      day.msPlayed > 0 && (!max || day.msPlayed > max.msPlayed)
        ? { day: day.day, msPlayed: day.msPlayed }
        : max,
    null,
  )

  return { currentStreak, longestStreak, activeDays: active.length, busiestDay }
}
