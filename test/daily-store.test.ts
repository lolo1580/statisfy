import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    user: { findUnique: vi.fn() },
    userDailyStat: { deleteMany: vi.fn(), findMany: vi.fn() },
    userArtistDailyStat: { deleteMany: vi.fn(), findMany: vi.fn() },
    userTrackDailyStat: { deleteMany: vi.fn(), findMany: vi.fn() },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  return { prismaMock };
});

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  getStoredArtistDailyStats,
  refreshUserStats,
  refreshUserStatsForRange,
} from "@/lib/stats/daily-store";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ timezone: "Europe/Paris" });
  prismaMock.userDailyStat.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.userArtistDailyStat.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.userTrackDailyStat.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.$executeRaw.mockResolvedValue(1);
  prismaMock.$transaction.mockImplementation(
    async (operations: Promise<unknown>[]) => Promise.all(operations),
  );
});

describe("refreshUserStatsForRange", () => {
  it("ne recalcule que les jours locaux couverts par la plage", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { day: "2026-10-27" },
      { day: "2026-10-28" },
    ]);

    await refreshUserStatsForRange(
      "u1",
      new Date("2026-10-27T22:00:00Z"),
      new Date("2026-10-28T22:00:00Z"),
    );

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    for (const table of [
      prismaMock.userDailyStat,
      prismaMock.userArtistDailyStat,
      prismaMock.userTrackDailyStat,
    ]) {
      expect(table.deleteMany).toHaveBeenCalledWith({
        where: { userId: "u1", day: { in: ["2026-10-27", "2026-10-28"] } },
      });
    }
    // 3 tables × (delete + insert)
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(3);
  });

  it("découpe les grosses plages en lots de 90 jours", async () => {
    const days = Array.from({ length: 100 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 0, 1 + index));
      return { day: date.toISOString().slice(0, 10) };
    });
    prismaMock.$queryRaw.mockResolvedValue(days);

    await refreshUserStatsForRange(
      "u1",
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-04-11T00:00:00Z"),
    );

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(prismaMock.userDailyStat.deleteMany).toHaveBeenCalledTimes(2);
    const [first, second] = prismaMock.userDailyStat.deleteMany.mock.calls;
    expect(first[0].where.day.in).toHaveLength(90);
    expect(second[0].where.day.in).toHaveLength(10);
  });

  it("ne fait rien sans jour concerné", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);

    await refreshUserStatsForRange(
      "u1",
      new Date("2026-10-27T00:00:00Z"),
      new Date("2026-10-28T00:00:00Z"),
    );

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("refreshUserStats (complet)", () => {
  it("remplace les trois tables dans une transaction", async () => {
    await refreshUserStats("u1");

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.userDailyStat.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
    expect(prismaMock.userArtistDailyStat.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
    expect(prismaMock.userTrackDailyStat.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(3);
  });
});

describe("getStoredArtistDailyStats", () => {
  it("convertit les BigInt en nombres", async () => {
    prismaMock.userArtistDailyStat.findMany.mockResolvedValue([
      { day: "2026-10-27", plays: 2, msPlayed: BigInt(1_000) },
    ]);

    await expect(getStoredArtistDailyStats("u1", "a1")).resolves.toEqual([
      { day: "2026-10-27", plays: 2, msPlayed: 1_000 },
    ]);
  });
});
