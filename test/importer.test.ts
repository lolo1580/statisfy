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
});
