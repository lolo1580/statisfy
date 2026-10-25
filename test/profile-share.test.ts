import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import {
  DEFAULT_PROFILE_SHARE_CONFIG,
  parseProfileShareConfig,
  serializeProfileShareConfig,
} from "@/lib/profile-share";

describe("parseProfileShareConfig", () => {
  it("retombe sur les défauts sans configuration", () => {
    expect(parseProfileShareConfig(null)).toEqual(DEFAULT_PROFILE_SHARE_CONFIG);
    expect(parseProfileShareConfig("")).toEqual(DEFAULT_PROFILE_SHARE_CONFIG);
  });

  it("lit les booléens présents", () => {
    expect(
      parseProfileShareConfig(
        JSON.stringify({
          topArtists: false,
          topTracks: true,
          recentPlays: true,
          heatmap: false,
        }),
      ),
    ).toEqual({
      topArtists: false,
      topTracks: true,
      recentPlays: true,
      heatmap: false,
    });
  });

  it("ignore les valeurs absentes ou invalides", () => {
    expect(
      parseProfileShareConfig(
        JSON.stringify({ topArtists: "yes", recentPlays: true }),
      ),
    ).toEqual({
      ...DEFAULT_PROFILE_SHARE_CONFIG,
      recentPlays: true,
    });
  });

  it("tolère un JSON corrompu", () => {
    expect(parseProfileShareConfig("{not json")).toEqual(
      DEFAULT_PROFILE_SHARE_CONFIG,
    );
  });
});

describe("serializeProfileShareConfig", () => {
  it("produit un JSON relisible", () => {
    const config = { ...DEFAULT_PROFILE_SHARE_CONFIG, recentPlays: true };
    expect(parseProfileShareConfig(serializeProfileShareConfig(config))).toEqual(
      config,
    );
  });
});
