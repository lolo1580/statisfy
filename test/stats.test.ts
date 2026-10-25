import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  const play = {
    aggregate: vi.fn(),
    groupBy: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
  };
  return {
    prismaMock: {
      play,
      artist: { findMany: vi.fn() },
      track: { findMany: vi.fn() },
      album: { findMany: vi.fn() },
      $queryRaw: vi.fn(),
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  getDailyStats,
  getListeningBehavior,
  getOverview,
  getRediscoveries,
  getTopArtistsBoth,
  getTopGenres,
  getTopGenresBoth,
  getTopTracksBoth,
  getWeeklyHourStats,
} from "@/lib/stats";

/** Index de tranche de 15 min (comme `getTimeBuckets`). */
function bucket(date: string): number {
  return Math.floor(Date.parse(date) / 1000 / 900);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getOverview", () => {
  it("agrège totaux et entités distinctes, et compte toutes les écoutes", async () => {
    const first = new Date("2020-01-02T00:00:00Z");
    const last = new Date("2026-10-17T00:00:00Z");
    prismaMock.play.aggregate.mockResolvedValue({
      _count: { _all: 12 },
      _sum: { msPlayed: 34_000 },
      _min: { playedAt: first },
      _max: { playedAt: last },
    });
    prismaMock.play.groupBy.mockResolvedValue([
      { artistId: "a1", trackId: "t1", albumId: "al1" },
      { artistId: "a1", trackId: "t2", albumId: "al1" },
      { artistId: "a2", trackId: "t3", albumId: null },
    ]);
    prismaMock.play.count.mockResolvedValue(20);

    const overview = await getOverview("u1", { days: null });

    expect(overview).toEqual({
      totalPlays: 12,
      allPlays: 20,
      totalMs: 34_000,
      distinctArtists: 2,
      distinctTracks: 3,
      distinctAlbums: 1,
      firstPlay: first,
      lastPlay: last,
    });
    // Le comptage « toutes écoutes » doit ignorer le filtre `counted`.
    expect(prismaMock.play.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ userId: "u1", counted: undefined }),
    });
  });
});

describe("getDailyStats", () => {
  it("pré-remplit chaque jour et ventile les tranches en heure locale", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { bucket: bucket("2026-10-16T22:30:00Z"), plays: 2, msPlayed: 1_000 },
      { bucket: bucket("2026-10-17T21:15:00Z"), plays: 3, msPlayed: 2_000 },
    ]);

    const days = await getDailyStats("u1", "Europe/Paris", {
      days: null,
      from: new Date("2026-10-16T00:00:00Z"),
      to: new Date("2026-10-18T00:00:00Z"),
    });

    expect(days.map((day) => day.day)).toEqual([
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
    expect(days.find((day) => day.day === "2026-10-17")).toEqual({
      day: "2026-10-17",
      plays: 5, // 00:30 puis 23:15 locales
      msPlayed: 3_000,
    });
    expect(days.find((day) => day.day === "2026-10-18")?.plays).toBe(0);
  });
});

describe("getWeeklyHourStats", () => {
  it("construit une grille lundi→dimanche × 24 h dans le fuseau demandé", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { bucket: bucket("2026-10-17T20:00:00Z"), plays: 4, msPlayed: 0 }, // sam. 22 h Paris
      { bucket: bucket("2026-10-18T00:00:00Z"), plays: 1, msPlayed: 0 }, // dim. 02 h Paris
    ]);

    const { grid, max } = await getWeeklyHourStats("u1", "Europe/Paris", {
      days: null,
      from: new Date("2026-10-12T00:00:00Z"),
      to: new Date("2026-10-19T00:00:00Z"),
    });

    expect(grid).toHaveLength(7);
    expect(grid.every((row) => row.length === 24)).toBe(true);
    expect(grid[5][22]).toBe(4); // samedi
    expect(grid[6][2]).toBe(1); // dimanche
    expect(max).toBe(4);
  });
});

describe("getTopGenres", () => {
  const grouped = [
    { artistId: "a1", _count: { artistId: 10 }, _sum: { msPlayed: 1_000 } },
    { artistId: "a2", _count: { artistId: 5 }, _sum: { msPlayed: 5_000 } },
  ];

  beforeEach(() => {
    prismaMock.play.groupBy.mockResolvedValue(grouped);
    prismaMock.artist.findMany.mockResolvedValue([
      { id: "a1", genres: '["rock","rock","indie"]' },
      { id: "a2", genres: '["rock"]' },
      { id: "a3", genres: "not json" }, // ignoré (pas dans le groupBy)
    ]);
  });

  it("somme les genres de tous les artistes, dédoublonne et trie par écoutes", async () => {
    const genres = await getTopGenres("u1", { days: 30 }, 10, "plays");

    expect(genres).toEqual([
      { genre: "rock", plays: 15, msPlayed: 6_000 },
      { genre: "indie", plays: 10, msPlayed: 1_000 },
    ]);
    // Pas de `take` : sinon les genres des artistes hors top disparaissent.
    expect(prismaMock.play.groupBy.mock.calls[0][0]).not.toHaveProperty("take");
  });

  it("trie par temps avec la métrique « time »", async () => {
    const genres = await getTopGenres("u1", { days: 30 }, 2, "time");
    expect(genres.map((genre) => genre.genre)).toEqual(["rock", "indie"]);
    expect(genres[0].msPlayed).toBe(6_000);
  });

  it("renvoie une liste vide sans écoutes", async () => {
    prismaMock.play.groupBy.mockResolvedValue([]);
    await expect(getTopGenres("u1", { days: 7 })).resolves.toEqual([]);
    expect(prismaMock.artist.findMany).not.toHaveBeenCalled();
  });
});

describe("getRediscoveries", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
  });

  it("garde les artistes assez écoutés et délaissés depuis le seuil", async () => {
    prismaMock.play.groupBy.mockResolvedValue([
      {
        artistId: "old-big",
        _count: { _all: 20 },
        _sum: { msPlayed: 9_000 },
        _max: { playedAt: new Date("2026-01-01T00:00:00Z") },
      },
      {
        artistId: "old-small",
        _count: { _all: 2 },
        _sum: { msPlayed: 8_000 },
        _max: { playedAt: new Date("2026-01-01T00:00:00Z") },
      },
      {
        artistId: "recent",
        _count: { _all: 50 },
        _sum: { msPlayed: 99_000 },
        _max: { playedAt: new Date("2026-05-30T00:00:00Z") },
      },
    ]);
    prismaMock.artist.findMany.mockResolvedValue([
      { id: "old-big", name: "Big", imageUrl: null, genres: null },
    ]);

    const found = await getRediscoveries("u1", {
      afterDays: 60,
      minPlays: 5,
      limit: 5,
    });

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      id: "old-big",
      name: "Big",
      plays: 20,
      msPlayed: 9_000,
      genres: [],
    });
  });
});

describe("classements double métrique", () => {
  it("getTopTracksBoth : une seule agrégation, titres lus une fois", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { id: "t1", plays: 10, msPlayed: 1_000, rp: 1, rt: 2, by_plays: true, by_time: true },
      { id: "t2", plays: 5, msPlayed: 9_000, rp: 2, rt: 1, by_plays: true, by_time: true },
      { id: "t3", plays: 1, msPlayed: 500, rp: 3, rt: 3, by_plays: false, by_time: false },
    ]);
    prismaMock.track.findMany.mockResolvedValue([
      {
        id: "t1",
        name: "One",
        imageUrl: "t1.jpg",
        artist: { id: "a1", name: "A" },
        album: { name: "Album", imageUrl: "al.jpg" },
      },
      {
        id: "t2",
        name: "Two",
        imageUrl: null,
        artist: { id: "a2", name: "B" },
        album: null,
      },
    ]);

    const both = await getTopTracksBoth("u1", { days: 7 }, 2);

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    expect(both.plays.map((track) => track.id)).toEqual(["t1", "t2"]);
    expect(both.time.map((track) => track.id)).toEqual(["t2", "t1"]);
    expect(both.plays[0]).toMatchObject({
      plays: 10,
      msPlayed: 1_000,
      artistName: "A",
      albumName: "Album",
      imageUrl: "al.jpg",
    });
    // Les pochettes de l'album priment sur celle du titre.
    expect(both.time[0]).toMatchObject({
      plays: 5,
      msPlayed: 9_000,
      albumName: null,
      imageUrl: null,
    });
    // Une seule lecture pour les deux classements, sur l'union des ids.
    expect(prismaMock.track.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.track.findMany.mock.calls[0][0].where.id.in.sort()).toEqual([
      "t1",
      "t2",
    ]);
  });

  it("getTopArtistsBoth : conserve les genres et l'ordre de chaque métrique", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { id: "a1", plays: 8, msPlayed: 2_000, rp: 1, rt: 2, by_plays: true, by_time: true },
      { id: "a2", plays: 3, msPlayed: 8_000, rp: 2, rt: 1, by_plays: true, by_time: true },
    ]);
    prismaMock.artist.findMany.mockResolvedValue([
      { id: "a1", name: "A", imageUrl: null, genres: '["rock"]' },
      { id: "a2", name: "B", imageUrl: "b.jpg", genres: null },
    ]);

    const both = await getTopArtistsBoth("u1", { days: null }, 2);

    expect(both.plays.map((artist) => artist.id)).toEqual(["a1", "a2"]);
    expect(both.time.map((artist) => artist.id)).toEqual(["a2", "a1"]);
    expect(both.plays[0].genres).toEqual(["rock"]);
    expect(both.time[0]).toMatchObject({ name: "B", genres: [] });
    expect(prismaMock.artist.findMany).toHaveBeenCalledTimes(1);
  });

  it("getTopGenresBoth : une agrégation pour les deux classements", async () => {
    prismaMock.play.groupBy.mockResolvedValue([
      { artistId: "a1", _count: { artistId: 10 }, _sum: { msPlayed: 1_000 } },
      { artistId: "a2", _count: { artistId: 2 }, _sum: { msPlayed: 9_000 } },
    ]);
    prismaMock.artist.findMany.mockResolvedValue([
      { id: "a1", genres: '["rock"]' },
      { id: "a2", genres: '["jazz"]' },
    ]);

    const both = await getTopGenresBoth("u1", { days: 30 }, 2);

    expect(prismaMock.play.groupBy).toHaveBeenCalledTimes(1);
    expect(both.plays.map((genre) => genre.genre)).toEqual(["rock", "jazz"]);
    expect(both.time.map((genre) => genre.genre)).toEqual(["jazz", "rock"]);
  });

  it("renvoie des listes vides sans écoute", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);
    await expect(getTopTracksBoth("u1", { days: 7 })).resolves.toEqual({
      plays: [],
      time: [],
    });
    expect(prismaMock.track.findMany).not.toHaveBeenCalled();
  });
});

describe("getListeningBehavior", () => {
  it("calcule les taux sur l'échantillon et garde les 5 appareils principaux", async () => {
    prismaMock.play.count
      .mockResolvedValueOnce(100) // échantillon
      .mockResolvedValueOnce(25) // skipped
      .mockResolvedValueOnce(40) // shuffle
      .mockResolvedValueOnce(10); // offline
    prismaMock.play.groupBy.mockResolvedValue([
      { platform: "Android", _count: { _all: 3 } },
      { platform: "iOS", _count: { _all: 9 } },
      { platform: "Web", _count: { _all: 6 } },
      { platform: "Desktop", _count: { _all: 4 } },
      { platform: "TV", _count: { _all: 2 } },
      { platform: "Watch", _count: { _all: 1 } },
    ]);

    const behavior = await getListeningBehavior("u1");

    expect(behavior.sample).toBe(100);
    expect(behavior.skippedRate).toBeCloseTo(0.25);
    expect(behavior.shuffleRate).toBeCloseTo(0.4);
    expect(behavior.offlineRate).toBeCloseTo(0.1);
    expect(behavior.platforms.map((row) => row.platform)).toEqual([
      "iOS",
      "Web",
      "Desktop",
      "Android",
      "TV",
    ]);
    expect(prismaMock.play.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ platform: { not: null } }),
    });
  });
});
