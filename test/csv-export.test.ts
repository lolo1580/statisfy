import { describe, expect, it } from "vitest";
import { CSV_HEADER, playToCsvRow, type CsvPlay } from "@/lib/csv-export";

function play(overrides: Partial<CsvPlay> = {}): CsvPlay {
  return {
    playedAt: new Date("2026-10-17T12:34:56.000Z"),
    msPlayed: 215_000,
    source: "spotify",
    context: "playlist",
    platform: "Android",
    country: "FR",
    skipped: false,
    shuffle: true,
    offline: null,
    incognito: null,
    reasonStart: "clickrow",
    reasonEnd: "trackdone",
    track: {
      name: "Song",
      artist: { name: "Artist" },
      album: { name: "Album" },
    },
    ...overrides,
  };
}

/** Découpe une ligne simple (sans valeur échappée) en cellules. */
function cells(row: string): string[] {
  return row.replace(/\n$/, "").split(",");
}

describe("playToCsvRow", () => {
  it("a un en-tête aligné sur les colonnes écrites", () => {
    expect(CSV_HEADER.trim().split(",")).toEqual([
      "played_at",
      "ms_played",
      "track",
      "artist",
      "album",
      "source",
      "context",
      "platform",
      "country",
      "skipped",
      "shuffle",
      "offline",
      "incognito",
      "reason_start",
      "reason_end",
    ]);
  });

  it("écrit toutes les colonnes, métadonnées comprises", () => {
    expect(cells(playToCsvRow(play()))).toEqual([
      "2026-10-17T12:34:56.000Z",
      "215000",
      "Song",
      "Artist",
      "Album",
      "spotify",
      "playlist",
      "Android",
      "FR",
      "false",
      "true",
      "", // offline
      "", // incognito
      "clickrow",
      "trackdone",
    ]);
  });

  it("laisse vides les métadonnées absentes (sync live / anciens imports)", () => {
    expect(
      cells(
        playToCsvRow(
          play({
            context: null,
            platform: null,
            country: null,
            skipped: null,
            shuffle: null,
            reasonStart: null,
            reasonEnd: null,
            track: { name: "Song", artist: { name: "Artist" }, album: null },
          }),
        ),
      ),
    ).toEqual([
      "2026-10-17T12:34:56.000Z",
      "215000",
      "Song",
      "Artist",
      "", // album
      "spotify",
      "", // context
      "", // platform
      "", // country
      "", // skipped
      "", // shuffle
      "", // offline
      "", // incognito
      "", // reason_start
      "", // reason_end
    ]);
  });

  it("échappe les valeurs dangereuses (formules, virgules)", () => {
    const row = playToCsvRow(
      play({
        source: "=cmd",
        track: {
          name: "Hello, world",
          artist: { name: 'A"B' },
          album: null,
        },
      }),
    );
    expect(row).toContain("'=cmd");
    expect(row).toContain('"Hello, world"');
    expect(row).toContain('"A""B"');
  });
});
