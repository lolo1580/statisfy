import "server-only";

import { Prisma } from "../generated/prisma/client";
import { isLogLevel, isLogSource, type LogLevel, type LogSource } from "./log";
import { nextLocalDayKey, startOfLocalDayKey } from "./format";

/** Filtres du journal, tels que sérialisés dans l'URL. */
export type LogFilters = {
  level: LogLevel | null;
  source: LogSource | null;
  q: string;
  /** Borne basse inclusive, date locale « YYYY-MM-DD ». */
  from: string | null;
  /** Borne haute inclusive, date locale « YYYY-MM-DD ». */
  to: string | null;
};

function first(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  return Array.isArray(value) ? value[0] : undefined;
}

function dayKey(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

/** Analyse et borne les paramètres de filtre (valeurs inconnues ignorées). */
export function parseLogFilters(params: {
  level?: string | string[];
  source?: string | string[];
  q?: string | string[];
  from?: string | string[];
  to?: string | string[];
}): LogFilters {
  const level = first(params.level);
  const source = first(params.source);
  const q = first(params.q)?.trim() ?? "";
  return {
    level: isLogLevel(level) ? level : null,
    source: isLogSource(source) ? source : null,
    q: q.slice(0, 120),
    from: dayKey(first(params.from)),
    to: dayKey(first(params.to)),
  };
}

/**
 * Clause `where` Prisma correspondant aux filtres. Les bornes `from`/`to` sont
 * interprétées comme des **jours locaux** dans le fuseau fourni (`to` inclus).
 */
export function logWhere(
  filters: LogFilters,
  timeZone: string,
): Prisma.LogEntryWhereInput {
  const where: Prisma.LogEntryWhereInput = {};
  if (filters.level) where.level = filters.level;
  if (filters.source) where.source = filters.source;
  if (filters.q) where.message = { contains: filters.q, mode: "insensitive" };

  const createdAt: Prisma.DateTimeFilter = {};
  if (filters.from) {
    const gte = startOfLocalDayKey(timeZone, filters.from);
    if (gte) createdAt.gte = gte;
  }
  if (filters.to) {
    const next = nextLocalDayKey(filters.to);
    const lt = next ? startOfLocalDayKey(timeZone, next) : null;
    if (lt) createdAt.lt = lt;
  }
  if (createdAt.gte || createdAt.lt) where.createdAt = createdAt;

  return where;
}

/** Sérialise les filtres (+ champs additionnels) en query string. */
export function logQueryString(
  filters: LogFilters,
  extra: Record<string, string | number> = {},
): string {
  const params = new URLSearchParams();
  if (filters.level) params.set("level", filters.level);
  if (filters.source) params.set("source", filters.source);
  if (filters.q) params.set("q", filters.q);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  for (const [key, value] of Object.entries(extra)) {
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
