import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findFirst: vi.fn() },
    play: { aggregate: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  buildStatsApiPayload,
  getAllTimeStats,
  getStatsApiUser,
  readStatsToken,
} from "@/lib/api/public-stats";

const NOW = new Date("2026-10-25T12:00:00.000Z");

function overview(overrides: Record<string, unknown> = {}) {
  return {
    totalPlays: 1800,
    allPlays: 2000,
    totalMs: 500_000_000,
    distinctArtists: 210,
    distinctTracks: 1200,
    distinctAlbums: 340,
    firstPlay: new Date("2026-09-25T00:00:00.000Z"),
    lastPlay: new Date("2026-10-25T11:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("readStatsToken", () => {
  const request = (url: string, headers: Record<string, string> = {}) =>
    new Request(url, { headers });

  it("lit le jeton depuis l'en-tête Bearer", () => {
    expect(
      readStatsToken(
        request("https://statisfy.example/api/public/stats", {
          authorization: "Bearer secret-token",
        }),
      ),
    ).toBe("secret-token");
  });

  it("lit le jeton depuis le paramètre token", () => {
    expect(
      readStatsToken(
        request("https://statisfy.example/api/public/stats?token=query-token"),
      ),
    ).toBe("query-token");
  });

  it("privilégie l'en-tête sur le paramètre", () => {
    expect(
      readStatsToken(
        request("https://statisfy.example/api/public/stats?token=query", {
          authorization: "bearer header",
        }),
      ),
    ).toBe("header");
  });

  it("renvoie null sans jeton", () => {
    expect(
      readStatsToken(request("https://statisfy.example/api/public/stats")),
    ).toBeNull();
  });
});

describe("getStatsApiUser", () => {
  it("renvoie null sans jeton sans interroger la base", async () => {
    await expect(getStatsApiUser(null)).resolves.toBeNull();
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
  });

  it("recherche le compte par jeton", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "u1",
      name: "Laurent",
      timezone: "Europe/Paris",
    });

    await expect(getStatsApiUser("token")).resolves.toEqual({
      id: "u1",
      name: "Laurent",
      timezone: "Europe/Paris",
    });
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { statsApiToken: "token" },
      select: { id: true, name: true, timezone: true },
    });
  });
});

describe("getAllTimeStats", () => {
  it("mappe l'agrégation", async () => {
    prismaMock.play.aggregate.mockResolvedValue({
      _count: { _all: 48213 },
      _sum: { msPlayed: 11_233_800_000 },
      _max: { playedAt: new Date("2026-10-25T08:12:00.000Z") },
    });

    await expect(getAllTimeStats("u1")).resolves.toEqual({
      plays: 48213,
      msPlayed: 11_233_800_000,
      lastPlayAt: new Date("2026-10-25T08:12:00.000Z"),
    });
    expect(prismaMock.play.aggregate).toHaveBeenCalledWith({
      where: { userId: "u1", counted: true },
      _count: { _all: true },
      _sum: { msPlayed: true },
      _max: { playedAt: true },
    });
  });
});

describe("buildStatsApiPayload", () => {
  it("produit une réponse plate, avec heures arrondies et dates ISO", () => {
    const payload = buildStatsApiPayload({
      user: { name: "Laurent" },
      rangeKey: "30",
      rangeFrom: new Date("2026-09-25T00:00:00.000Z"),
      overview: overview(),
      topArtist: {
        id: "a1",
        name: "Radiohead",
        plays: 41,
        msPlayed: 9_000_000,
        imageUrl: "https://img/artist.jpg",
        genres: [],
      },
      topTrack: {
        id: "t1",
        name: "Weird Fishes",
        plays: 12,
        msPlayed: 4_800_000,
        artistId: "a1",
        artistName: "Radiohead",
        albumName: "In Rainbows",
        imageUrl: "https://img/track.jpg",
      },
      totals: {
        plays: 48213,
        msPlayed: 11_233_800_000,
        lastPlayAt: new Date("2026-10-25T08:12:00.000Z"),
      },
      today: { plays: 12, msPlayed: 3_240_000 },
      week: { plays: 412, msPlayed: 108_720_000 },
      month: { plays: 1800, msPlayed: 500_000_000 },
      now: NOW,
    });

    expect(payload).toEqual({
      user: "Laurent",
      generatedAt: NOW.toISOString(),
      range: "30",
      rangeFrom: "2026-09-25T00:00:00.000Z",
      plays: 1800,
      listeningMs: 500_000_000,
      hours: 138.9,
      artists: 210,
      tracks: 1200,
      albums: 340,
      allTimePlays: 48213,
      allTimeHours: 3120.5,
      lastPlayAt: "2026-10-25T08:12:00.000Z",
      todayPlays: 12,
      todayHours: 0.9,
      weekPlays: 412,
      weekHours: 30.2,
      monthPlays: 1800,
      monthHours: 138.9,
      topArtist: "Radiohead",
      topArtistPlays: 41,
      topArtistImage: "https://img/artist.jpg",
      topTrack: "Weird Fishes",
      topTrackArtist: "Radiohead",
      topTrackPlays: 12,
      topTrackImage: "https://img/track.jpg",
    });
  });

  it("gère un compte sans écoute", () => {
    const payload = buildStatsApiPayload({
      user: { name: "Nouveau" },
      rangeKey: "all",
      rangeFrom: null,
      overview: overview({
        totalPlays: 0,
        allPlays: 0,
        totalMs: 0,
        distinctArtists: 0,
        distinctTracks: 0,
        distinctAlbums: 0,
        firstPlay: null,
        lastPlay: null,
      }),
      topArtist: null,
      topTrack: null,
      totals: { plays: 0, msPlayed: 0, lastPlayAt: null },
      today: { plays: 0, msPlayed: 0 },
      week: { plays: 0, msPlayed: 0 },
      month: { plays: 0, msPlayed: 0 },
      now: NOW,
    });

    expect(payload.range).toBe("all");
    expect(payload.rangeFrom).toBeNull();
    expect(payload.hours).toBe(0);
    expect(payload.lastPlayAt).toBeNull();
    expect(payload.topArtist).toBeNull();
    expect(payload.topTrack).toBeNull();
  });
});
