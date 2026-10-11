import { describe, expect, it } from "vitest";
import { computeTrends } from "@/lib/trends";

const map = (entries: Array<[string, number]>) => new Map(entries);

describe("computeTrends", () => {
  it("classe les hausses et les baisses par écart", () => {
    const current = map([
      ["a", 10],
      ["b", 3],
      ["c", 5],
    ]);
    const previous = map([
      ["a", 4],
      ["b", 9],
      ["c", 5],
      ["d", 2],
    ]);
    const result = computeTrends(current, previous, 10);

    expect(result.rising.map((r) => r.id)).toEqual(["a"]); // +6
    // b : -6, d : -2 (absent du courant), c : delta 0 → ignoré.
    expect(result.falling.map((r) => r.id)).toEqual(["b", "d"]);
    expect(result.hasPrevious).toBe(true);
  });

  it("respecte la limite par côté", () => {
    const current = map([
      ["a", 10],
      ["b", 8],
      ["c", 1],
    ]);
    const previous = map([
      ["a", 1],
      ["b", 1],
      ["c", 5],
    ]);
    const result = computeTrends(current, previous, 1);

    expect(result.rising).toHaveLength(1);
    expect(result.falling.map((r) => r.id)).toEqual(["c"]);
  });

  it("gère une entité nouvelle ou disparue", () => {
    const result = computeTrends(map([["new", 3]]), map([["gone", 4]]), 5);

    expect(result.rising[0]).toMatchObject({ id: "new", previous: 0, delta: 3 });
    expect(result.falling[0]).toMatchObject({ id: "gone", current: 0, delta: -4 });
  });

  it("signale l'absence de période précédente", () => {
    const result = computeTrends(map([["a", 2]]), map([]), 5);

    expect(result.hasPrevious).toBe(false);
    expect(result.rising.map((r) => r.id)).toEqual(["a"]);
    expect(result.falling).toEqual([]);
  });
});
