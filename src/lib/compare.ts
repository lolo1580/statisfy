import type { WrappedPeriod } from "./period";

/** Données temporelles minimales nécessaires à la comparaison. */
export type TimelineExtras = {
  daily: { key: string; msPlayed: number }[];
  monthly: { key: string; msPlayed: number }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Nombre de jours couverts par une période. */
export function daysInPeriod(
  period: Pick<WrappedPeriod, "from" | "to">,
): number {
  return Math.max(
    1,
    Math.round((period.to.getTime() - period.from.getTime()) / DAY_MS),
  );
}

/** Pourcentage d'évolution de `a` par rapport à `b` (null si `b` est nul). */
export function percentChange(a: number, b: number): number | null {
  if (b <= 0) return null;
  return Math.round(((a - b) / b) * 100);
}

/**
 * Construit une série alignée sur la période : par mois (années entières) ou par
 * jour de la période (mois). Les deux périodes partagent les mêmes libellés.
 */
export function buildSeries(
  period: Pick<WrappedPeriod, "from">,
  extras: TimelineExtras,
  mode: "month" | "day",
  slots: number,
  monthsShort: string[],
): { label: string; value: number }[] {
  if (mode === "month") {
    const values = new Array<number>(12).fill(0);
    for (const bucket of extras.monthly) {
      const index = Number(bucket.key.slice(5, 7)) - 1;
      if (index >= 0 && index < 12) values[index] += bucket.msPlayed;
    }
    return monthsShort.map((label, index) => ({ label, value: values[index] }));
  }
  const values = new Array<number>(slots).fill(0);
  for (const bucket of extras.daily) {
    const index = Math.round(
      (Date.parse(`${bucket.key}T00:00:00Z`) - period.from.getTime()) / DAY_MS,
    );
    if (index >= 0 && index < slots) values[index] += bucket.msPlayed;
  }
  return values.map((value, index) => ({ label: String(index + 1), value }));
}

/**
 * Points de comparaison alignés de deux périodes : par mois pour deux années
 * entières, par jour (index relatif) sinon.
 */
export function comparisonSeries(
  periodA: WrappedPeriod,
  extrasA: TimelineExtras,
  periodB: WrappedPeriod,
  extrasB: TimelineExtras,
  monthsShort: string[],
): { label: string; a: number; b: number }[] {
  const monthlyMode = !periodA.isMonth && !periodB.isMonth;
  const slots = monthlyMode
    ? 12
    : Math.max(daysInPeriod(periodA), daysInPeriod(periodB));
  const mode = monthlyMode ? "month" : "day";
  const seriesA = buildSeries(periodA, extrasA, mode, slots, monthsShort);
  const seriesB = buildSeries(periodB, extrasB, mode, slots, monthsShort);
  return seriesA.map((point, index) => ({
    label: point.label,
    a: point.value,
    b: seriesB[index]?.value ?? 0,
  }));
}
