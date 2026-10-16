import { describe, expect, it, vi } from "vitest";
import { bucketCount, resetTokens, takeToken } from "@/lib/rate-limit-store";

describe("rate-limit-store", () => {
  it("autorise jusqu'à la limite puis refuse", () => {
    const key = `k-${Math.random()}`;
    expect(takeToken(key, 3, 1000)).toBe(true);
    expect(takeToken(key, 3, 1000)).toBe(true);
    expect(takeToken(key, 3, 1000)).toBe(true);
    expect(takeToken(key, 3, 1000)).toBe(false);
  });

  it("réinitialise le compteur d'une clé", () => {
    const key = `k-${Math.random()}`;
    expect(takeToken(key, 1, 1000)).toBe(true);
    expect(takeToken(key, 1, 1000)).toBe(false);
    resetTokens(key);
    expect(takeToken(key, 1, 1000)).toBe(true);
  });

  it("réouvre un seau après expiration de la fenêtre", () => {
    vi.useFakeTimers();
    try {
      const key = `k-${Math.random()}`;
      expect(takeToken(key, 1, 1000)).toBe(true);
      expect(takeToken(key, 1, 1000)).toBe(false);
      vi.advanceTimersByTime(1001);
      expect(takeToken(key, 1, 1000)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("isole les clés distinctes", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(takeToken(a, 1, 1000)).toBe(true);
    expect(takeToken(a, 1, 1000)).toBe(false);
    expect(takeToken(b, 1, 1000)).toBe(true);
  });

  it("n'évince pas un seau encore actif lors d'un flood de clés", () => {
    const victim = `victim-${Math.random()}`;
    expect(takeToken(victim, 1, 60_000)).toBe(true);
    expect(takeToken(victim, 1, 60_000)).toBe(false);
    for (let i = 0; i < 6000; i += 1) {
      takeToken(`flood-evict-${i}`, 1, 60_000);
    }
    // Le compteur de la victime doit toujours être là (pas de contournement).
    expect(takeToken(victim, 1, 60_000)).toBe(false);
  });

  it("borne le nombre de seaux malgré un flood de clés distinctes", () => {
    for (let i = 0; i < 6000; i += 1) {
      takeToken(`flood-${i}`, 1, 60_000);
    }
    expect(bucketCount()).toBeLessThanOrEqual(5000);
  });
});
