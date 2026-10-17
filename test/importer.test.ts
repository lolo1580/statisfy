import { describe, expect, it } from "vitest";
import { parseSpotifyHistory } from "@/lib/sources/importer";

describe("parseSpotifyHistory", () => {
  it("marque l'origine des écoutes importées comme « import »", () => {
    const plays = parseSpotifyHistory(
      JSON.stringify([
        {
          ts: "2024-05-01T10:00:00Z",
          ms_played: 210_000,
          master_metadata_track_name: "Titre",
          master_metadata_album_artist_name: "Artiste",
          master_metadata_album_album_name: "Album",
          spotify_track_uri: "spotify:track:abc",
        },
      ]),
    );

    expect(plays).toHaveLength(1);
    expect(plays[0].provider).toBe("spotify");
    expect(plays[0].origin).toBe("import");
    expect(plays[0].externalTrackId).toBe("abc");
    expect(plays[0].context).toBe("import");
  });

  it("ignore les lignes sans titre/artiste/date", () => {
    expect(parseSpotifyHistory(JSON.stringify([{ foo: "bar" }]))).toEqual([]);
  });

  it("extrait les métadonnées de comportement de l'export étendu", () => {
    const plays = parseSpotifyHistory(
      JSON.stringify([
        {
          ts: "2024-05-01T10:00:00Z",
          ms_played: 210_000,
          master_metadata_track_name: "Titre",
          master_metadata_album_artist_name: "Artiste",
          master_metadata_album_album_name: "Album",
          spotify_track_uri: "spotify:track:abc",
          platform: "android",
          conn_country: "FR",
          skipped: true,
          shuffle: false,
          offline: true,
          incognito_mode: false,
          reason_start: "trackdone",
          reason_end: "fwdbtn",
        },
      ]),
    );

    expect(plays[0]).toMatchObject({
      platform: "android",
      country: "FR",
      skipped: true,
      shuffle: false,
      offline: true,
      incognito: false,
      reasonStart: "trackdone",
      reasonEnd: "fwdbtn",
    });
  });

  it("laisse les métadonnées absentes sur l'export classique", () => {
    const plays = parseSpotifyHistory(
      JSON.stringify([
        {
          endTime: "2024-05-01 14:23",
          artistName: "Artiste",
          trackName: "Titre",
          msPlayed: 1000,
        },
      ]),
    );

    expect(plays[0].platform).toBeUndefined();
    expect(plays[0].skipped).toBeUndefined();
  });

  it("interprète les dates sans fuseau (export classique) comme UTC", () => {
    const plays = parseSpotifyHistory(
      JSON.stringify([
        {
          endTime: "2024-05-01 14:23",
          artistName: "Artiste",
          trackName: "Titre",
          msPlayed: 1000,
        },
      ]),
    );

    expect(plays).toHaveLength(1);
    // Sans le correctif, la date serait lue comme heure locale du serveur.
    expect(plays[0].playedAt.toISOString()).toBe("2024-05-01T14:23:00.000Z");
  });

  it("respecte un fuseau explicite quand il est présent", () => {
    const plays = parseSpotifyHistory(
      JSON.stringify([
        {
          endTime: "2024-05-01T14:23:00+02:00",
          artistName: "Artiste",
          trackName: "Titre",
          msPlayed: 1000,
        },
      ]),
    );

    expect(plays[0].playedAt.toISOString()).toBe("2024-05-01T12:23:00.000Z");
  });
});
