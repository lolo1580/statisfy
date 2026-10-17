import { describe, expect, it } from "vitest";
import { computeRecords } from "@/lib/records";

const day = (day: string, plays: number, msPlayed = plays * 1000) => ({
  day,
  plays,
  msPlayed,
});

describe("computeRecords", () => {
  it("calcule la meilleure série, la série en cours et les jours actifs", () => {
    const records = computeRecords(
      [
        day("2024-01-01", 2, 1_000),
        day("2024-01-02", 1, 5_000),
        day("2024-01-03", 3, 2_000),
        day("2024-01-10", 1, 500),
      ],
      "2024-01-10",
    );

    expect(records.longestStreak).toBe(3);
    expect(records.currentStreak).toBe(1);
    expect(records.activeDays).toBe(4);
    expect(records.busiestDay).toEqual({ day: "2024-01-02", msPlayed: 5_000 });
  });

  it("compte la série en cours depuis hier si rien aujourd'hui", () => {
    const records = computeRecords(
      [day("2024-01-01", 1), day("2024-01-02", 1), day("2024-01-03", 1)],
      "2024-01-04",
    );
    expect(records.currentStreak).toBe(3);
  });

  it("remet la série en cours à zéro au-delà d'un jour creux", () => {
    const records = computeRecords(
      [day("2024-01-01", 1), day("2024-01-02", 1)],
      "2024-01-05",
    );
    expect(records.currentStreak).toBe(0);
  });

  it("franchit les changements de mois", () => {
    const records = computeRecords(
      [day("2024-01-31", 1), day("2024-02-01", 1)],
      "2024-02-01",
    );
    expect(records.longestStreak).toBe(2);
    expect(records.currentStreak).toBe(2);
  });

  it("ignore les jours sans écoute et les doublons", () => {
    const records = computeRecords(
      [day("2024-01-01", 0), day("2024-01-02", 2), day("2024-01-02", 1)],
      "2024-01-02",
    );
    expect(records.activeDays).toBe(1);
    expect(records.longestStreak).toBe(1);
    expect(records.busiestDay).toEqual({ day: "2024-01-02", msPlayed: 2_000 });
  });

  it("renvoie des valeurs nulles quand aucune écoute", () => {
    const records = computeRecords([], "2024-01-01");
    expect(records).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      activeDays: 0,
      busiestDay: null,
    });
  });
});
