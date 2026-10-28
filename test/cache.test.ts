import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheGet,
  cacheGetOrSet,
  cacheStats,
  clearCache,
  invalidateCache,
} from "@/lib/cache";

beforeEach(() => {
  clearCache();
  vi.useRealTimers();
});

describe("cacheGetOrSet", () => {
  it("met en cache et respecte le TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const load = vi.fn().mockResolvedValue("value");

    expect(await cacheGetOrSet("key", 1_000, load)).toBe("value");
    expect(await cacheGetOrSet("key", 1_000, load)).toBe("value");
    expect(load).toHaveBeenCalledTimes(1);
    expect(cacheGet("key")).toBe("value");

    vi.setSystemTime(new Date("2026-01-01T00:00:02.000Z"));
    expect(cacheGet("key")).toBeUndefined();

    await cacheGetOrSet("key", 1_000, load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("déduplique les chargements concurrents", async () => {
    let resolve!: (value: string) => void;
    const load = vi.fn(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );

    const first = cacheGetOrSet("key", 1_000, load);
    const second = cacheGetOrSet("key", 1_000, load);

    expect(load).toHaveBeenCalledTimes(1);
    resolve("value");
    expect(await first).toBe("value");
    expect(await second).toBe("value");
  });

  it("ne met rien en cache quand le TTL est nul", async () => {
    const load = vi.fn().mockResolvedValue("value");

    await cacheGetOrSet("key", 0, load);
    await cacheGetOrSet("key", 0, load);

    expect(load).toHaveBeenCalledTimes(2);
    expect(cacheGet("key")).toBeUndefined();
  });
});

describe("invalidation", () => {
  it("invalide uniquement le préfixe demandé", async () => {
    await cacheGetOrSet("stats:u1:overview", 1_000, async () => 1);
    await cacheGetOrSet("stats:u2:overview", 1_000, async () => 2);
    await cacheGetOrSet("other:key", 1_000, async () => 3);

    expect(invalidateCache("stats:u1:")).toBe(1);
    expect(cacheGet("stats:u1:overview")).toBeUndefined();
    expect(cacheGet("stats:u2:overview")).toBe(2);
    expect(cacheGet("other:key")).toBe(3);

    expect(invalidateCache()).toBe(2);
    expect(cacheStats().size).toBe(0);
  });

  it("ne réinsère pas un chargement terminé après invalidation", async () => {
    let resolve!: (value: string) => void;
    const load = vi.fn(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );

    const pending = cacheGetOrSet("stats:u1:overview", 1_000, load);
    invalidateCache("stats:u1:");
    resolve("stale");
    await pending;

    expect(cacheGet("stats:u1:overview")).toBeUndefined();
  });
});
