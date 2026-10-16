import { describe, expect, it } from "vitest";
import { buildDedupKey } from "@/lib/sync/dedup";
import type { RawPlay } from "@/lib/sources/types";

function play(overrides: Partial<RawPlay> = {}): RawPlay {
  return {
    provider: "spotify",
    trackName: "Titre",
    artistName: "Artiste",
    playedAt: new Date("2024-05-01T10:00:00.000Z"),
    ...overrides,
  };
}

describe("buildDedupKey", () => {
  it("ignore les millisecondes (sync vs import identiques)", () => {
    const synced = buildDedupKey(
      play({ playedAt: new Date("2024-05-01T10:00:00.351Z") }),
    );
    const imported = buildDedupKey(
      play({ playedAt: new Date("2024-05-01T10:00:00.000Z") }),
    );
    expect(synced).toBe(imported);
  });

  it("distingue deux écoutes à des secondes différentes", () => {
    const a = buildDedupKey(play({ playedAt: new Date("2024-05-01T10:00:00Z") }));
    const b = buildDedupKey(play({ playedAt: new Date("2024-05-01T10:00:01Z") }));
    expect(a).not.toBe(b);
  });

  it("utilise l'identifiant externe de piste quand il est présent", () => {
    const key = buildDedupKey(play({ externalTrackId: "abc", trackName: "Autre" }));
    expect(key.startsWith("spotify|abc|")).toBe(true);
  });

  it("retombe sur artiste::titre normalisé sans identifiant externe", () => {
    const key = buildDedupKey(play({ artistName: " Artiste ", trackName: "TITRE" }));
    expect(key).toContain("spotify|artiste::titre|");
  });
});
