/** Helpers de parsing d'URL (côté serveur, hors composants client). */

import {
  startOfLocalDay,
  startOfLocalMonth,
  startOfLocalWeek,
  startOfLocalYear,
} from "./format";

export type ParsedRange = {
  days: number | null;
  key: string;
  /** Borne basse explicite (ex. « aujourd'hui » = depuis minuit, heure locale). */
  from?: Date;
  to?: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Nombre de jours locaux entiers entre `from` (minuit local) et aujourd'hui, inclus. */
function elapsedDays(from: Date, timeZone: string, now: Date): number {
  const today = startOfLocalDay(timeZone, now);
  return Math.max(1, Math.round((today.getTime() - from.getTime()) / DAY_MS) + 1);
}

/** Période sélectionnée par défaut : aujourd'hui. */
export const DEFAULT_RANGE = "today";

export function parseRange(
  value: string | undefined,
  timeZone?: string,
): ParsedRange {
  const key = value ?? DEFAULT_RANGE;
  if (key === "all") return { days: null, key: "all" };

  if (timeZone) {
    const now = new Date();
    if (key === "today") {
      return { days: 1, key: "today", from: startOfLocalDay(timeZone, now) };
    }
    if (key === "week") {
      const from = startOfLocalWeek(timeZone, now);
      return { days: elapsedDays(from, timeZone, now), key: "week", from };
    }
    if (key === "month") {
      const from = startOfLocalMonth(timeZone, now);
      return { days: elapsedDays(from, timeZone, now), key: "month", from };
    }
    if (key === "year") {
      const from = startOfLocalYear(timeZone, now);
      return { days: elapsedDays(from, timeZone, now), key: "year", from };
    }
  } else if (key === "today" || key === "week" || key === "month" || key === "year") {
    // Sans fuseau : bornes approximatives (fenêtre glissante).
    const fallback: Record<string, number> = {
      today: 1,
      week: 7,
      month: 30,
      year: 365,
    };
    return { days: fallback[key], key };
  }

  const days = Number(key);
  if (!Number.isFinite(days) || days <= 0) return { days: 30, key: "30" };
  return { days, key: String(days) };
}
