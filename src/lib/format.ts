/** Utilitaires d'affichage et de gestion du temps. */

export function formatDuration(ms: number, locale: string = "fr"): string {
  if (!ms || ms < 0) return "0 min";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  // Seule l'unité « jour » diffère selon la langue (j / d).
  const dayUnit = locale.toLowerCase().startsWith("fr") ? "j" : "d";
  if (days > 0) {
    return hours === 0 ? `${days} ${dayUnit}` : `${days} ${dayUnit} ${hours} h`;
  }
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${String(minutes).padStart(2, "0")}`;
}

export function formatNumber(value: number, locale: string = "en"): string {
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * Décalage (ms) d'un fuseau IANA par rapport à UTC à un instant donné.
 * Positif à l'est de Greenwich.
 */
/**
 * Décale (ms) d'un fuseau IANA par rapport à UTC à un instant donné.
 * Positif à l'est de Greenwich.
 *
 * Le résultat est mémorisé par fuseau et par **heure** UTC : les changements
 * d'heure n'interviennent qu'une à deux fois par an, donc ce cache reste correct
 * partout sauf au maximum l'heure de bascule. La taille du cache est bornée.
 */
const OFFSET_CACHE = new Map<string, number>();
const CACHE_STEP_MS = 3_600_000;
const OFFSET_CACHE_MAX = 20_000;

export function getTimezoneOffsetMs(
  timeZone: string,
  at: Date = new Date(),
): number {
  const key = `${timeZone}|${Math.floor(at.getTime() / CACHE_STEP_MS)}`;
  const cached = OFFSET_CACHE.get(key);
  if (cached !== undefined) return cached;

  let result = 0;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
    const parts = formatter.formatToParts(at);
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? 0);
    // `fractionalSecondDigits` garantit un décalage exact à la milliseconde :
    // sans les ms, l'offset pouvait être décalé de <1 s et faire basculer la
    // clé de jour (minuit local) sur la veille.
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
      get("fractionalSecond"),
    );
    result = asUtc - at.getTime();
  } catch {
    result = 0;
  }
  if (OFFSET_CACHE.size >= OFFSET_CACHE_MAX) OFFSET_CACHE.clear();
  OFFSET_CACHE.set(key, result);
  return result;
}

/** Clé de jour locale « YYYY-MM-DD » pour un instant donné. */
export function dayKey(
  date: Date,
  timeZone: string,
  offsetMs?: number,
): string {
  const offset = offsetMs ?? getTimezoneOffsetMs(timeZone, date);
  return new Date(date.getTime() + offset).toISOString().slice(0, 10);
}

/** Heure locale (0-23). */
export function hourOf(
  date: Date,
  timeZone: string,
  offsetMs?: number,
): number {
  const offset = offsetMs ?? getTimezoneOffsetMs(timeZone, date);
  return new Date(date.getTime() + offset).getUTCHours();
}

/** Instant (UTC) correspondant à minuit local pour une date locale donnée. */
function localMidnight(
  timeZone: string,
  year: number,
  month: number,
  day: number,
): Date {
  const utcGuess = Date.UTC(year, month, day, 0, 0, 0);
  // Le décalage peut différer à la date cible (changement d'heure) : on affine.
  let offset = getTimezoneOffsetMs(timeZone, new Date(utcGuess));
  let instant = utcGuess - offset;
  offset = getTimezoneOffsetMs(timeZone, new Date(instant));
  instant = utcGuess - offset;
  return new Date(instant);
}

/** Composantes locales d'un instant (année, mois 0-based, jour, jour de semaine). */
function localParts(
  timeZone: string,
  at: Date,
): { year: number; month: number; day: number; dow: number } {
  const offset = getTimezoneOffsetMs(timeZone, at);
  const local = new Date(at.getTime() + offset);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth(),
    day: local.getUTCDate(),
    dow: local.getUTCDay(),
  };
}

/** Début du jour local (minuit dans le fuseau donné). */
export function startOfLocalDay(
  timeZone: string,
  now: Date = new Date(),
): Date {
  const { year, month, day } = localParts(timeZone, now);
  return localMidnight(timeZone, year, month, day);
}

/**
 * Instant (UTC) correspondant à minuit local pour une date locale « YYYY-MM-DD »
 * (champ `<input type="date">`). Renvoie `null` si la date est invalide.
 */
export function startOfLocalDayKey(timeZone: string, key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  // Rejette les dates « impossibles » (ex. 2026-02-30) que Date normalise.
  const check = new Date(Date.UTC(year, month, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return localMidnight(timeZone, year, month, day);
}

/** Jour suivant d'une date locale « YYYY-MM-DD » (ou `null` si invalide). */
export function nextLocalDayKey(key: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1),
  );
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/** Début de la semaine locale (lundi). */
export function startOfLocalWeek(
  timeZone: string,
  now: Date = new Date(),
): Date {
  const { year, month, day, dow } = localParts(timeZone, now);
  const daysSinceMonday = (dow + 6) % 7;
  return localMidnight(timeZone, year, month, day - daysSinceMonday);
}

/** Début du mois local (le 1er à minuit). */
export function startOfLocalMonth(
  timeZone: string,
  now: Date = new Date(),
): Date {
  const { year, month } = localParts(timeZone, now);
  return localMidnight(timeZone, year, month, 1);
}

/** Début de l'année locale (1er janvier à minuit). */
export function startOfLocalYear(
  timeZone: string,
  now: Date = new Date(),
): Date {
  const { year } = localParts(timeZone, now);
  return localMidnight(timeZone, year, 0, 1);
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

/**
 * Durée relative compacte (« il y a 2 minutes », « 2 minutes ago »).
 * Utilisée pour les états “dernier événement / dernière erreur”.
 */
export function formatRelative(
  date: Date,
  locale: string = "en",
  now: Date = new Date(),
): string {
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (abs < 60_000) return rtf.format(Math.round(diff / 1_000), "second");
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) {
    return rtf.format(Math.round(diff / 3_600_000), "hour");
  }
  if (abs < 30 * 86_400_000) {
    return rtf.format(Math.round(diff / 86_400_000), "day");
  }
  if (abs < 365 * 86_400_000) {
    return rtf.format(Math.round(diff / (30 * 86_400_000)), "month");
  }
  return rtf.format(Math.round(diff / (365 * 86_400_000)), "year");
}

/**
 * Libellé court d'un jour (`YYYY-MM-DD` → `JJ/MM/AA`), indépendant de la
 * locale : utilisé sur les axes de graphiques où l'espace est contraint.
 */
export function formatDayShort(isoDay: string): string {
  return `${isoDay.slice(8, 10)}/${isoDay.slice(5, 7)}/${isoDay.slice(2, 4)}`;
}
