import { describe, expect, it } from "vitest";
import {
  dayKey,
  formatDuration,
  formatNumber,
  formatRelative,
  getTimezoneOffsetMs,
  hourOf,
  startOfLocalDay,
  startOfLocalMonth,
  startOfLocalWeek,
  startOfLocalYear,
} from "@/lib/format";

const HOUR = 3_600_000;

describe("formatRelative", () => {
  const now = new Date("2026-10-25T12:00:00.000Z");

  it("formate les durées passées", () => {
    expect(
      formatRelative(new Date("2026-10-25T11:58:00.000Z"), "fr", now),
    ).toContain("2");
    expect(
      formatRelative(new Date("2026-10-25T11:58:00.000Z"), "en", now),
    ).toContain("2");
  });

  it("gère l'instant présent", () => {
    expect(formatRelative(now, "en", now)).toBe("now");
  });
});

describe("formatDuration", () => {
  it("gère les valeurs nulles ou négatives", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(-1000)).toBe("0 min");
  });

  it("affiche minutes, heures et jours", () => {
    expect(formatDuration(5 * 60_000)).toBe("5 min");
    expect(formatDuration(60 * 60_000)).toBe("1 h");
    expect(formatDuration(65 * 60_000)).toBe("1 h 05");
    expect(formatDuration(24 * 60 * 60_000)).toBe("1 j");
    expect(formatDuration(26 * 60 * 60_000)).toBe("1 j 2 h");
  });
});

describe("formatNumber", () => {
  it("suit la locale", () => {
    expect(formatNumber(1234, "en")).toBe("1,234");
    expect(formatNumber(1234, "fr")).not.toBe("1,234");
  });
});

describe("dayKey / hourOf", () => {
  it("utilise le fuseau demandé", () => {
    const instant = new Date("2026-10-11T23:30:00Z");
    expect(dayKey(instant, "UTC")).toBe("2026-10-11");
    expect(dayKey(instant, "Asia/Tokyo")).toBe("2026-10-12");
    expect(hourOf(instant, "UTC")).toBe(23);
    expect(hourOf(instant, "Asia/Tokyo")).toBe(8);
  });
});

describe("getTimezoneOffsetMs", () => {
  it("gère UTC, un décalage fixe et l'heure d'été", () => {
    expect(getTimezoneOffsetMs("UTC", new Date("2026-07-15T12:00:00Z"))).toBe(0);
    expect(getTimezoneOffsetMs("Asia/Tokyo", new Date("2026-07-15T12:00:00Z"))).toBe(
      9 * HOUR,
    );
    // Zurich : UTC+2 en été, UTC+1 en hiver.
    expect(
      getTimezoneOffsetMs("Europe/Zurich", new Date("2026-07-15T12:00:00Z")),
    ).toBe(2 * HOUR);
    expect(
      getTimezoneOffsetMs("Europe/Zurich", new Date("2026-01-15T12:00:00Z")),
    ).toBe(1 * HOUR);
  });
});

describe("startOfLocal*", () => {
  const now = new Date("2026-10-11T12:34:56Z");

  it("calcule les bornes en UTC", () => {
    expect(startOfLocalDay("UTC", now).toISOString()).toBe(
      "2026-10-11T00:00:00.000Z",
    );
    // 2026-10-11 est un dimanche : la semaine commence le lundi 5.
    expect(startOfLocalWeek("UTC", now).toISOString()).toBe(
      "2026-10-05T00:00:00.000Z",
    );
    expect(startOfLocalMonth("UTC", now).toISOString()).toBe(
      "2026-10-01T00:00:00.000Z",
    );
    expect(startOfLocalYear("UTC", now).toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("respecte les changements d'heure", () => {
    expect(
      startOfLocalDay("Europe/Zurich", new Date("2026-07-15T10:00:00Z")).toISOString(),
    ).toBe("2026-07-14T22:00:00.000Z");
    expect(
      startOfLocalDay("Europe/Zurich", new Date("2026-01-15T10:00:00Z")).toISOString(),
    ).toBe("2026-01-14T23:00:00.000Z");
  });
});
