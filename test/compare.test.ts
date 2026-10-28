import { describe, expect, it } from "vitest";
import {
  buildSeries,
  comparisonSeries,
  daysInPeriod,
  percentChange,
} from "@/lib/compare";
import { parseWrappedPeriod } from "@/lib/period";

const monthsShort = [
  "J",
  "F",
  "M",
  "A",
  "M",
  "J",
  "J",
  "A",
  "S",
  "O",
  "N",
  "D",
];
const now = new Date("2026-06-01T00:00:00Z");
const year = (y: string) => parseWrappedPeriod(y, undefined, now);
const month = (y: string, m: string) => parseWrappedPeriod(y, m, now);

describe("percentChange", () => {
  it("arrondit l'évolution et renvoie null sans référence", () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(80, 100)).toBe(-20);
    expect(percentChange(100, 50)).toBe(100);
    expect(percentChange(100, 0)).toBeNull();
  });
});

describe("daysInPeriod", () => {
  it("compte les jours calendaires (bissextile inclus)", () => {
    expect(daysInPeriod(year("2026"))).toBe(365);
    expect(daysInPeriod(month("2026", "2"))).toBe(28);
    expect(daysInPeriod(month("2024", "2"))).toBe(29);
  });
});

describe("buildSeries", () => {
  it("agrège par mois pour une année entière", () => {
    const series = buildSeries(
      year("2026"),
      {
        daily: [],
        monthly: [
          { key: "2026-01", msPlayed: 100 },
          { key: "2026-03", msPlayed: 50 },
        ],
      },
      "month",
      12,
      monthsShort,
    );
    expect(series).toHaveLength(12);
    expect(series[0]).toEqual({ label: "J", value: 100 });
    expect(series[1]).toEqual({ label: "F", value: 0 });
    expect(series[2]).toEqual({ label: "M", value: 50 });
  });

  it("place les jours à leur index relatif pour un mois", () => {
    const series = buildSeries(
      month("2026", "3"),
      {
        daily: [
          { key: "2026-03-01", msPlayed: 10 },
          { key: "2026-03-15", msPlayed: 20 },
        ],
        monthly: [],
      },
      "day",
      31,
      monthsShort,
    );
    expect(series).toHaveLength(31);
    expect(series[0]).toEqual({ label: "1", value: 10 });
    expect(series[14]).toEqual({ label: "15", value: 20 });
  });
});

describe("comparisonSeries", () => {
  it("aligne deux années par mois", () => {
    const points = comparisonSeries(
      year("2026"),
      { daily: [], monthly: [{ key: "2026-01", msPlayed: 100 }] },
      year("2025"),
      { daily: [], monthly: [{ key: "2025-01", msPlayed: 40 }] },
      monthsShort,
    );
    expect(points).toHaveLength(12);
    expect(points[0]).toEqual({ label: "J", a: 100, b: 40 });
    expect(points[1]).toEqual({ label: "F", a: 0, b: 0 });
  });

  it("aligne deux mois par jour (longueur = le plus long)", () => {
    const points = comparisonSeries(
      month("2026", "1"),
      { daily: [{ key: "2026-01-31", msPlayed: 9 }], monthly: [] },
      month("2026", "2"),
      { daily: [{ key: "2026-02-01", msPlayed: 5 }], monthly: [] },
      monthsShort,
    );
    expect(points).toHaveLength(31);
    expect(points[0]).toEqual({ label: "1", a: 0, b: 5 });
    expect(points[30]).toEqual({ label: "31", a: 9, b: 0 });
  });
});
