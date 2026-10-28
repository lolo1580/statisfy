import { describe, expect, it } from "vitest";
import {
  pickDiverseRediscoveries,
  rankRediscoveries,
  rediscoveryScore,
  type RediscoveryCandidate,
} from "@/lib/rediscoveries";

const now = new Date("2026-06-01T00:00:00Z");

const base: RediscoveryCandidate = {
  plays: 10,
  msPlayed: 30_000,
  lastPlayedAt: new Date("2026-03-01T00:00:00Z"),
  firstPlayedAt: new Date("2025-06-01T00:00:00Z"),
  activeMonths: 3,
};

describe("rediscoveryScore", () => {
  it("récompense les écoutes, le silence, la longévité et la régularité", () => {
    const reference = rediscoveryScore(base, now).score;

    expect(rediscoveryScore({ ...base, plays: 40 }, now).score).toBeGreaterThan(
      reference,
    );
    expect(
      rediscoveryScore(
        { ...base, lastPlayedAt: new Date("2025-01-01T00:00:00Z") },
        now,
      ).score,
    ).toBeGreaterThan(reference);
    expect(
      rediscoveryScore(
        { ...base, firstPlayedAt: new Date("2024-01-01T00:00:00Z") },
        now,
      ).score,
    ).toBeGreaterThan(reference);
    expect(
      rediscoveryScore({ ...base, activeMonths: 1 }, now).score,
    ).toBeLessThan(reference);
  });

  it("plafonne le bonus de silence au-delà de ~9 mois", () => {
    const fiveYears = rediscoveryScore(
      {
        ...base,
        firstPlayedAt: new Date("2020-01-01T00:00:00Z"),
        lastPlayedAt: new Date("2025-01-01T00:00:00Z"),
      },
      now,
    ).score;
    const twoYears = rediscoveryScore(
      {
        ...base,
        firstPlayedAt: new Date("2020-01-01T00:00:00Z"),
        lastPlayedAt: new Date("2022-01-01T00:00:00Z"),
      },
      now,
    ).score;
    expect(twoYears).toBe(fiveYears);
  });
});

describe("rankRediscoveries / pickDiverseRediscoveries", () => {
  const candidates = [
    {
      ...base,
      id: "rock-high",
      plays: 50,
      genres: ["rock"],
      lastPlayedAt: new Date("2025-06-01T00:00:00Z"),
      firstPlayedAt: new Date("2023-01-01T00:00:00Z"),
    },
    {
      ...base,
      id: "rock-mid",
      plays: 20,
      genres: ["rock"],
      lastPlayedAt: new Date("2025-06-01T00:00:00Z"),
      firstPlayedAt: new Date("2023-01-01T00:00:00Z"),
    },
    {
      ...base,
      id: "jazz-low",
      plays: 6,
      genres: ["jazz"],
      lastPlayedAt: new Date("2025-06-01T00:00:00Z"),
      firstPlayedAt: new Date("2023-01-01T00:00:00Z"),
    },
  ];

  it("trie par score décroissant", () => {
    expect(rankRediscoveries(candidates, now).map((e) => e.item.id)).toEqual([
      "rock-high",
      "rock-mid",
      "jazz-low",
    ]);
  });

  it("prend un artiste par genre principal puis complète", () => {
    const ranked = rankRediscoveries(candidates, now);
    expect(pickDiverseRediscoveries(ranked, 2).map((e) => e.item.id)).toEqual([
      "rock-high",
      "jazz-low",
    ]);
    // Pas assez de genres distincts : on complète dans l'ordre du score.
    expect(pickDiverseRediscoveries(ranked, 3).map((e) => e.item.id)).toEqual([
      "rock-high",
      "rock-mid",
      "jazz-low",
    ]);
  });

  it("gère les genres absents et une limite nulle", () => {
    const ranked = rankRediscoveries(
      candidates.map((candidate) => ({ ...candidate, genres: [] })),
      now,
    );
    expect(pickDiverseRediscoveries(ranked, 2)).toHaveLength(2);
    expect(pickDiverseRediscoveries(ranked, 0)).toEqual([]);
  });
});
