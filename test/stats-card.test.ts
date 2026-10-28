import { describe, expect, it } from "vitest";
import { escapeXml, renderStatsCard } from "@/lib/api/stats-card";
import type { StatsApiPayload } from "@/lib/api/public-stats";

const PAYLOAD: StatsApiPayload = {
  user: "Laurent",
  generatedAt: "2026-10-25T12:00:00.000Z",
  range: "30",
  rangeFrom: null,
  plays: 501,
  listeningMs: 106_560_000,
  hours: 29.6,
  artists: 120,
  tracks: 380,
  albums: 210,
  allTimePlays: 12156,
  allTimeHours: 741.8,
  lastPlayAt: null,
  todayPlays: 0,
  todayHours: 0,
  weekPlays: 116,
  weekHours: 6.6,
  monthPlays: 501,
  monthHours: 29.6,
  topArtist: "Ice Nine Kills",
  topArtistPlays: 36,
  topArtistImage: null,
  topTrack: "The Laugh Track",
  topTrackArtist: "Ice Nine Kills",
  topTrackPlays: 3,
  topTrackImage: null,
};

describe("escapeXml", () => {
  it("échappe les caractères réservés", () => {
    expect(escapeXml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;",
    );
  });
});

describe("renderStatsCard", () => {
  it("rend un SVG avec les valeurs principales", () => {
    const svg = renderStatsCard(PAYLOAD);
    expect(svg).toContain("<svg");
    expect(svg).toContain("Laurent");
    expect(svg).toContain("741.8");
    expect(svg).toContain("12,156");
    expect(svg).toContain("Ice Nine Kills");
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("<image");
  });

  it("applique le thème clair et la locale française", () => {
    const svg = renderStatsCard(PAYLOAD, { theme: "light", locale: "fr" });
    expect(svg).toContain("#ffffff");
    expect(svg).toContain("741,8");
    expect(svg).toMatch(/12[\s\u202f]156/);
    expect(svg).toContain("écoutes sur la période");
  });

  it("échappe le nom et l'artiste (pas d'injection SVG)", () => {
    const svg = renderStatsCard({
      ...PAYLOAD,
      user: `<script>alert("x")</script>`,
      topArtist: `A & B`,
      topTrack: `<foreignObject>`,
    });
    expect(svg).not.toContain("<script>alert");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("A &amp; B");
    expect(svg).toContain("&lt;foreignObject&gt;");
  });
});
