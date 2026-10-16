import { describe, expect, it } from "vitest";
import {
  isPlayCounted,
  MIN_LISTEN_RATIO,
  safeListenRatio,
} from "../src/lib/play-counting";

describe("isPlayCounted", () => {
  it("compte une écoute complète", () => {
    expect(isPlayCounted(200_000, 200_000)).toBe(true);
  });

  it("compte à partir de 3/4 de la durée (inclus)", () => {
    expect(isPlayCounted(150_000, 200_000)).toBe(true); // exactement 75 %
    expect(isPlayCounted(149_999, 200_000)).toBe(false);
  });

  it("ne compte pas une écoute trop courte", () => {
    expect(isPlayCounted(30_000, 200_000)).toBe(false);
    expect(isPlayCounted(0, 200_000)).toBe(false);
  });

  it("compte quand la durée est inconnue ou invalide", () => {
    expect(isPlayCounted(1_000, null)).toBe(true);
    expect(isPlayCounted(1_000, undefined)).toBe(true);
    expect(isPlayCounted(1_000, 0)).toBe(true);
    expect(isPlayCounted(1_000, -5)).toBe(true);
  });

  it("expose le seuil 3/4", () => {
    expect(MIN_LISTEN_RATIO).toBe(0.75);
  });

  it("respecte un seuil personnalisé", () => {
    expect(isPlayCounted(500_000, 1_000_000, 0.5)).toBe(true);
    expect(isPlayCounted(499_999, 1_000_000, 0.5)).toBe(false);
    // 0 % : tout compte (même une écoute quasi nulle).
    expect(isPlayCounted(0, 1_000_000, 0)).toBe(true);
  });

  it("normalise un seuil invalide vers 3/4", () => {
    expect(safeListenRatio(-1)).toBe(0.75);
    expect(safeListenRatio(2)).toBe(0.75);
    expect(safeListenRatio(Number.NaN)).toBe(0.75);
    expect(safeListenRatio(0)).toBe(0);
    expect(safeListenRatio(1)).toBe(1);
  });
});
