import { describe, expect, it } from "vitest";
import {
  formatPeriodLabel,
  monthNames,
  monthShortNames,
  parseWrappedPeriod,
} from "@/lib/period";

const now = new Date("2026-06-01T00:00:00Z");

describe("parseWrappedPeriod", () => {
  it("découpe une année entière", () => {
    const p = parseWrappedPeriod("2025", undefined, now);
    expect(p.year).toBe(2025);
    expect(p.month).toBeNull();
    expect(p.isMonth).toBe(false);
    expect(p.from.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(p.to.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(p.prevFrom.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(p.prevTo.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(p.key).toBe("2025");
  });

  it("découpe un mois précis", () => {
    const p = parseWrappedPeriod("2026", "3", now);
    expect(p.month).toBe(3);
    expect(p.isMonth).toBe(true);
    expect(p.from.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(p.to.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(p.prevFrom.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(p.prevTo.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(p.key).toBe("2026-03");
  });

  it("retombe sur l'année courante pour une entrée invalide", () => {
    const p = parseWrappedPeriod("1999", "13", now);
    expect(p.year).toBe(2026);
    expect(p.month).toBeNull();
  });
});

describe("formatPeriodLabel", () => {
  it("année et mois localisés", () => {
    expect(
      formatPeriodLabel(
        parseWrappedPeriod("2025", undefined, now),
        "en",
        "Year {year}",
      ),
    ).toBe("Year 2025");
    expect(
      formatPeriodLabel(
        parseWrappedPeriod("2026", "3", now),
        "en",
        "Year {year}",
      ),
    ).toBe("March 2026");
  });
});

describe("noms des mois", () => {
  it("renvoie 12 entrées localisées", () => {
    expect(monthNames("en")).toHaveLength(12);
    expect(monthNames("en")[0]).toBe("January");
    expect(monthShortNames("fr")[0]).toBe("janv.");
  });
});
