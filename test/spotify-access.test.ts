import { describe, expect, it } from "vitest";
import {
  SPOTIFY_ACCESS_APPROVED,
  SPOTIFY_ACCESS_NONE,
  SPOTIFY_ACCESS_PENDING,
  SPOTIFY_ACCESS_REJECTED,
  isSpotifyAccessGranted,
} from "@/lib/spotify-access-rules";

describe("spotify-access-rules", () => {
  it("autorise toujours les administrateurs", () => {
    expect(
      isSpotifyAccessGranted({
        isAdmin: true,
        status: SPOTIFY_ACCESS_NONE,
        hasConnection: false,
      }),
    ).toBe(true);
  });

  it("autorise les demandes approuvées", () => {
    expect(
      isSpotifyAccessGranted({
        isAdmin: false,
        status: SPOTIFY_ACCESS_APPROVED,
        hasConnection: false,
      }),
    ).toBe(true);
  });

  it("autorise une connexion Spotify existante (compatibilité)", () => {
    expect(
      isSpotifyAccessGranted({
        isAdmin: false,
        status: SPOTIFY_ACCESS_NONE,
        hasConnection: true,
      }),
    ).toBe(true);
  });

  it("refuse les comptes sans accès (none / pending / rejected)", () => {
    for (const status of [
      SPOTIFY_ACCESS_NONE,
      SPOTIFY_ACCESS_PENDING,
      SPOTIFY_ACCESS_REJECTED,
    ]) {
      expect(
        isSpotifyAccessGranted({ isAdmin: false, status, hasConnection: false }),
      ).toBe(false);
    }
  });
});
