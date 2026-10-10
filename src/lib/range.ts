/** Helpers de parsing d'URL (côté serveur, hors composants client). */

import {
  startOfLocalDay,
  startOfLocalMonth,
  startOfLocalWeek,
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

export function parseRange(
  value: string | undefined,
  timeZone?: string,
): ParsedRange {
  if (!value || value === "all") return { days: null, key: "all" };

  if (timeZone) {
    const now = new Date();
    if (value === "today") {
      return { days: 1, key: "today", from: startOfLocalDay(timeZone, now) };
    }
    if (value === "week") {
      const from = startOfLocalWeek(timeZone, now);
      return { days: elapsedDays(from, timeZone, now), key: "week", from };
    }
    if (value === "month") {
      const from = startOfLocalMonth(timeZone, now);
      return { days: elapsedDays(from, timeZone, now), key: "month", from };
    }
  }

  const days = Number(value);
  if (!Number.isFinite(days) || days <= 0) return { days: 30, key: "30" };
  return { days, key: String(days) };
}

export function parseSource(value: string | undefined): string | null {
  if (!value || value === "all") return null;
  return value;
}
