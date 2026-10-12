import { describe, expect, it } from "vitest";
import { parseRange } from "@/lib/range";

describe("parseRange", () => {
  it("utilise « aujourd'hui » par défaut", () => {
    expect(parseRange(undefined)).toEqual({ days: 1, key: "today" });
    const p = parseRange(undefined, "UTC");
    expect(p.key).toBe("today");
    expect(p.days).toBe(1);
    expect(p.from).toBeInstanceOf(Date);
  });

  it("traite « all » comme tout l'historique", () => {
    expect(parseRange("all")).toEqual({ days: null, key: "all" });
  });

  it("part de minuit local pour « today »", () => {
    const p = parseRange("today", "UTC");
    expect(p.key).toBe("today");
    expect(p.days).toBe(1);
    expect(p.from?.getUTCHours()).toBe(0);
    expect(p.from?.getUTCMinutes()).toBe(0);
  });

  it("parse une fenêtre glissante en jours", () => {
    expect(parseRange("30")).toEqual({ days: 30, key: "30" });
  });

  it("retombe sur 30 jours si l'entrée est invalide", () => {
    expect(parseRange("abc")).toEqual({ days: 30, key: "30" });
    expect(parseRange("-5")).toEqual({ days: 30, key: "30" });
  });

  it("borne le paramètre ?range=<jours>", () => {
    expect(parseRange("999999")).toEqual({ days: 3660, key: "3660" });
  });

  it("calcule les bornes calendaires (semaine/mois/année)", () => {
    for (const key of ["week", "month", "year"]) {
      const p = parseRange(key, "UTC");
      expect(p.key).toBe(key);
      expect(p.days).toBeGreaterThanOrEqual(1);
      expect(p.from).toBeInstanceOf(Date);
    }
  });
});
