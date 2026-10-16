import { describe, expect, it } from "vitest";
import { serialize } from "bson";
import { mapYourSpotifyData, peekCollection } from "@/lib/sources/your-spotify";

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

  it("normalise les dates Extended JSON de mongoexport ({ $date })", () => {
    const { plays } = mapYourSpotifyData({
      artists: [],
      albums: [],
      tracks: [],
      infos: [
        {
          id: "t1",
          played_at: { $date: "2024-05-01T10:00:00Z" },
        },
      ],
    });

    expect(plays).toHaveLength(1);
    expect(plays[0].playedAt.toISOString()).toBe("2024-05-01T10:00:00.000Z");
  });
});

describe("peekCollection", () => {
  it("retrouve la collection via un nom de fichier fourni", () => {
    const buffer = new Uint8Array(serialize({ played_at: new Date() }));
    expect(peekCollection(buffer, "infos.bson")).toBe("infos");
  });

  it("devine la collection d'un document BSON sans nom", () => {
    expect(
      peekCollection(new Uint8Array(serialize({ played_at: new Date(), id: "x" }))),
    ).toBe("infos");
  });

  it("devine la collection d'un document JSONL sans nom", () => {
    const json = new TextEncoder().encode(
      '{"id":"x","duration_ms":200000,"name":"Titre"}\n',
    );
    expect(peekCollection(json)).toBe("tracks");
  });

  it("renvoie null si la collection est indéterminable", () => {
    expect(peekCollection(new Uint8Array(serialize({ foo: "bar" })))).toBeNull();
  });
});
