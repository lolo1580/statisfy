import { describe, expect, it } from "vitest";
import { mapYourSpotifyData } from "@/lib/sources/your-spotify";

describe("mapYourSpotifyData", () => {
  it("marque l'origine comme « import » et résout les métadonnées", () => {
    const { plays } = mapYourSpotifyData({
      artists: [
        {
          id: "a 1",
          name: "Artiste",
          genres: ["metal"],
          images: [{ url: "https://cdn/artist.jpg" }],
        },
      ],
      albums: [{ id: "al1", name: "Album", images: [{ url: "https://cdn/album.jpg" }] }],
      tracks: [{ id: "t1", name: "Titre", duration_ms: 200_000 }],
      infos: [
        {
          id: "t1",
          albumId: "al1",
          primaryArtistId: "a 1",
          durationMs: 200_000,
          played_at: "2024-05-01T10:00:00Z",
        },
      ],
    });

    expect(plays).toHaveLength(1);
    expect(plays[0].provider).toBe("spotify");
    expect(plays[0].origin).toBe("import");
    expect(plays[0].artistName).toBe("Artiste");
    expect(plays[0].albumName).toBe("Album");
    expect(plays[0].imageUrl).toBe("https://cdn/album.jpg");
    expect(plays[0].artistImageUrl).toBe("https://cdn/artist.jpg");
  });
});
