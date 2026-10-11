/**
 * Calcul pur des tendances : compare deux fenêtres consécutives (comptages par
 * identifiant) et renvoie les plus fortes hausses et baisses.
 *
 * Sans dépendance serveur, donc testable isolément.
 */
export type TrendCount = {
  id: string
  current: number
  previous: number
  delta: number
}

export type TrendCounts = {
  rising: TrendCount[]
  falling: TrendCount[]
  hasPrevious: boolean
}

/**
 * `current` / `previous` : nombre d'écoutes par identifiant sur chaque fenêtre.
 * `limit` : nombre de lignes retenues par côté.
 */
export function computeTrends(
  current: Map<string, number>,
  previous: Map<string, number>,
  limit: number,
): TrendCounts {
  const ids = new Set([...current.keys(), ...previous.keys()])
  const rows: TrendCount[] = [...ids].map((id) => {
    const c = current.get(id) ?? 0
    const p = previous.get(id) ?? 0
    return { id, current: c, previous: p, delta: c - p }
  })

  return {
    rising: rows
      .filter((r) => r.delta > 0)
      .sort((a, b) => b.delta - a.delta || b.current - a.current)
      .slice(0, limit),
    falling: rows
      .filter((r) => r.delta < 0)
      .sort((a, b) => a.delta - b.delta || a.current - b.current)
      .slice(0, limit),
    hasPrevious: previous.size > 0,
  }
}
