import "server-only";

import { Prisma } from "../../generated/prisma/client";
import { dayKey, startOfLocalDay } from "../format";

/**
 * Filtres applicables aux agrégations.
 * - `days: null` = tout l'historique.
 * - `artistId` / `trackId` / `albumId` restreignent à une entité.
 */
export type StatsRange = {
  days: number | null;
  artistId?: string;
  trackId?: string;
  albumId?: string;
  /** Bornes explicites (prioritaires sur `days`). `to` est exclusif. */
  from?: Date;
  to?: Date;
};

export function buildWhere(
  userId: string,
  range: StatsRange,
): Prisma.PlayWhereInput {
  const where: Prisma.PlayWhereInput = { userId, counted: true };
  if (range.from || range.to) {
    where.playedAt = {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lt: range.to } : {}),
    };
  } else if (range.days) {
    where.playedAt = {
      gte: new Date(Date.now() - range.days * 24 * 60 * 60 * 1000),
    };
  }
  if (range.artistId) where.artistId = range.artistId;
  if (range.trackId) where.trackId = range.trackId;
  if (range.albumId) where.albumId = range.albumId;
  return where;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse défensif du JSON des genres stockés (`[]` si absent ou corrompu). */
export function parseGenres(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    // Dédoublonne : un même genre présent deux fois serait compté deux fois.
    return [
      ...new Set(parsed.filter((g): g is string => typeof g === "string")),
    ];
  } catch {
    return [];
  }
}

export const BUCKET_SECONDS = 900;

/**
 * Conditions SQL des agrégations brutes : mêmes règles que `buildWhere`, pour
 * que les requêtes `$queryRaw` et Prisma restent cohérentes.
 */
export function rangeConditions(
  userId: string,
  range: StatsRange,
): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"userId" = ${userId}`,
    Prisma.sql`"counted" = true`,
  ];
  if (range.from) conditions.push(Prisma.sql`"playedAt" >= ${range.from}`);
  if (range.to) conditions.push(Prisma.sql`"playedAt" < ${range.to}`);
  if (!range.from && !range.to && range.days) {
    conditions.push(
      Prisma.sql`"playedAt" >= ${new Date(Date.now() - range.days * DAY_MS)}`,
    );
  }
  if (range.artistId)
    conditions.push(Prisma.sql`"artistId" = ${range.artistId}`);
  if (range.trackId) conditions.push(Prisma.sql`"trackId" = ${range.trackId}`);
  if (range.albumId) conditions.push(Prisma.sql`"albumId" = ${range.albumId}`);
  return conditions;
}

/**
 * Bornes de jours locaux d'une période, si elle est exprimable en **jours
 * entiers** : c'est la condition pour lire les agrégats quotidiens au lieu des
 * écoutes brutes. Renvoie `null` quand les bornes ne coïncident pas avec des
 * minuits locaux (période glissante, bornes UTC d'un récap…).
 */
export type RangeDayBounds = { fromDay?: string; toDay?: string };

export function rangeDayBounds(
  range: StatsRange,
  timeZone: string,
): RangeDayBounds | null {
  // Les tables d'agrégats n'ont pas de dimension entité.
  if (range.artistId || range.trackId || range.albumId) return null;

  // Période glissante « N derniers jours » : pas alignée sur des jours locaux.
  if (!range.from && !range.to && range.days !== null) return null;

  let fromDay: string | undefined;
  if (range.from) {
    if (
      startOfLocalDay(timeZone, range.from).getTime() !== range.from.getTime()
    ) {
      return null;
    }
    fromDay = dayKey(range.from, timeZone);
  }

  let toDay: string | undefined;
  if (range.to) {
    if (startOfLocalDay(timeZone, range.to).getTime() !== range.to.getTime()) {
      return null;
    }
    // `to` est exclusif : le dernier jour inclus est la veille locale.
    toDay = dayKey(new Date(range.to.getTime() - 1), timeZone);
  }

  return { fromDay, toDay };
}

/** Instant UTC du début d'une tranche (index de tranches de 15 min). */
export function bucketDate(bucket: number): Date {
  return new Date(bucket * BUCKET_SECONDS * 1000);
}
