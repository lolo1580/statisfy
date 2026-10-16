import { describe, expect, it } from "vitest";
import {
  createTempId,
  describeError,
  optimisticReducer,
  type OptimisticRecord,
} from "@/lib/optimistic";

type Row = OptimisticRecord & { name: string; admin?: boolean };

const base: Row[] = [
  { id: "a", name: "Alice", admin: true },
  { id: "b", name: "Bob", admin: false },
];

describe("optimisticReducer", () => {
  it("ajoute en fin de liste par défaut", () => {
    const next = optimisticReducer(base, {
      type: "add",
      item: { id: "c", name: "Carol" },
    });
    expect(next.map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  it("ajoute en tête avec position « start » (créations récentes d'abord)", () => {
    const next = optimisticReducer(base, {
      type: "add",
      item: { id: "c", name: "Carol" },
      position: "start",
    });
    expect(next.map((row) => row.id)).toEqual(["c", "a", "b"]);
  });

  it("met à jour uniquement la ligne ciblée", () => {
    const next = optimisticReducer(base, {
      type: "update",
      id: "b",
      patch: { admin: true, name: "Bobby" },
    });
    expect(next[0]).toEqual(base[0]);
    expect(next[1]).toEqual({ id: "b", name: "Bobby", admin: true });
  });

  it("supprime la ligne ciblée", () => {
    const next = optimisticReducer(base, { type: "remove", id: "a" });
    expect(next.map((row) => row.id)).toEqual(["b"]);
  });

  it("ne mute jamais la liste d'origine", () => {
    const snapshot = JSON.stringify(base);
    optimisticReducer(base, { type: "remove", id: "a" });
    optimisticReducer(base, { type: "update", id: "a", patch: { name: "x" } });
    optimisticReducer(base, { type: "add", item: { id: "c", name: "c" } });
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});

describe("createTempId", () => {
  it("préfixe l'identifiant temporaire et reste unique", () => {
    const first = createTempId("invite");
    const second = createTempId("invite");
    expect(first.startsWith("invite:")).toBe(true);
    expect(first).not.toBe(second);
  });
});

describe("describeError", () => {
  it("affiche un repli localisé pour les erreurs techniques", () => {
    expect(describeError(new Error("Failed to fetch"), "fallback")).toBe(
      "fallback",
    );
    expect(describeError(undefined, "fallback")).toBe("fallback");
  });

  it("conserve une chaîne lancée explicitement", () => {
    expect(describeError("oops", "fallback")).toBe("oops");
  });
});
