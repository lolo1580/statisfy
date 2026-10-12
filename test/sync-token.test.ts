import { afterEach, describe, expect, it, vi } from "vitest";
import { hasValidSyncToken, safeEqual } from "@/lib/auth/sync-token";

describe("safeEqual", () => {
  it("accepte deux chaînes identiques", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
  });

  it("refuse des chaînes différentes de même longueur", () => {
    expect(safeEqual("abc123", "abc124")).toBe(false);
  });

  it("refuse des longueurs différentes", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("gère les chaînes vides", () => {
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("hasValidSyncToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("refuse quand aucun jeton n'est configuré", () => {
    // `SYNC_TOKEN` n'est pas défini dans l'environnement de test.
    expect(hasValidSyncToken("Bearer whatever")).toBe(false);
    expect(hasValidSyncToken(null)).toBe(false);
    expect(hasValidSyncToken(undefined)).toBe(false);
  });

  it("accepte le bon jeton (Bearer ou brut) et refuse les autres", async () => {
    vi.stubEnv("SYNC_TOKEN", "s3cret-token");
    vi.resetModules();
    const mod = await import("@/lib/auth/sync-token");
    expect(mod.hasValidSyncToken("Bearer s3cret-token")).toBe(true);
    expect(mod.hasValidSyncToken("s3cret-token")).toBe(true);
    expect(mod.hasValidSyncToken("Bearer wrong")).toBe(false);
    expect(mod.hasValidSyncToken(null)).toBe(false);
  });
});
