import { describe, expect, it } from "vitest";
import { retryDelayMs } from "@/lib/sources/spotify-http";

describe("retryDelayMs", () => {
  it("respecte l'en-tête Retry-After (secondes)", () => {
    expect(retryDelayMs("2", 0)).toBe(2000);
    expect(retryDelayMs("0.5", 0)).toBe(500);
  });

  it("plafonne un Retry-After très grand", () => {
    expect(retryDelayMs("999", 0)).toBe(30_000);
  });

  it("applique un backoff exponentiel sans en-tête", () => {
    expect(retryDelayMs(null, 0)).toBe(500);
    expect(retryDelayMs(null, 1)).toBe(1000);
    expect(retryDelayMs(null, 2)).toBe(2000);
    expect(retryDelayMs(null, 10)).toBe(30_000);
  });

  it("ignore un en-tête invalide", () => {
    expect(retryDelayMs("abc", 1)).toBe(1000);
  });
});
