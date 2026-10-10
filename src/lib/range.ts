/** Helpers de parsing d'URL (côté serveur, hors composants client). */

import { startOfLocalDay } from "./format";

export type ParsedRange = {
  days: number | null;
  key: string;
  /** Bornes explicites (ex. « aujourd'hui » = depuis minuit, heure locale). */
  from?: Date;
  to?: Date;
};

export function parseRange(
  value: string | undefined,
  timeZone?: string,
): ParsedRange {
  if (!value || value === "all") return { days: null, key: "all" };
  if (value === "today") {
    return {
      days: 1,
      key: "today",
      from: timeZone ? startOfLocalDay(timeZone) : undefined,
    };
  }
  const days = Number(value);
  if (!Number.isFinite(days) || days <= 0) return { days: 30, key: "30" };
  return { days, key: String(days) };
}

export function parseSource(value: string | undefined): string | null {
  if (!value || value === "all") return null;
  return value;
}
