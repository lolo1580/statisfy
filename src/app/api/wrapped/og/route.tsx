import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getSharedUserId } from "@/lib/wrapped-share";
import { prisma } from "@/lib/db";
import type { StatsRange } from "@/lib/stats";
import { getOverview, getTopArtists, getTopTracks } from "@/lib/stats/cached";
import { formatPeriodLabel, parseWrappedPeriod } from "@/lib/period";
import { formatDuration, formatNumber } from "@/lib/format";
import { getDictionary, translate } from "@/i18n";
import { takeToken } from "@/lib/rate-limit-store";
import { pickClientIp } from "@/lib/client-ip";
import { appName } from "@/lib/env";

export const dynamic = "force-dynamic";

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ display: "flex", fontSize: 54, fontWeight: 800 }}>
        {value}
      </span>
      <span
        style={{
          display: "flex",
          marginTop: 4,
          fontSize: 20,
          color: "#93a1b5",
        }}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Image Open Graph publique (1200×630) d'un récapitulatif partagé.
 *
 * Accessible sans session : le jeton de partage fait office de capability.
 * Aucune image distante n'est chargée (rendu purement textuel et rapide).
 */
export async function GET(request: NextRequest) {
  const ip = pickClientIp(
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
  );
  if (!takeToken(`wrapped-og:${ip}`, 120, 60_000)) {
    return new Response("Too many requests", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  const params = new URL(request.url).searchParams;
  const token = params.get("token") ?? "";
  const userId = await getSharedUserId(token);
  if (!userId) return new Response("Not found", { status: 404 });

  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, timezone: true },
  });
  if (!owner) return new Response("Not found", { status: 404 });

  const locale = params.get("locale") === "fr" ? "fr" : "en";
  const dictionary = getDictionary(locale);
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(dictionary, key, vars);

  const period = parseWrappedPeriod(
    params.get("year") ?? undefined,
    params.get("month") ?? undefined,
  );
  const filters: StatsRange = {
    days: null,
    from: period.from,
    to: period.to,
  };

  const [overview, artists, tracks] = await Promise.all([
    getOverview(userId, filters),
    getTopArtists(userId, filters, 1, "plays", owner.timezone),
    getTopTracks(userId, filters, 1, "plays", owner.timezone),
  ]);

  const periodLabel = formatPeriodLabel(period, locale, t("recap.yearLabel"));
  const topArtist = truncate(artists[0]?.name ?? "—", 28);
  const topTrack = truncate(
    tracks[0] ? `${tracks[0].name} — ${tracks[0].artistName}` : "—",
    38,
  );
  const ownerName = truncate(owner.name, 28);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        background:
          "linear-gradient(135deg, #0a0d12 0%, #0f2a20 55%, #1a1330 100%)",
        color: "#eef2f7",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 24,
          color: "#93a1b5",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              display: "flex",
              width: 20,
              height: 20,
              borderRadius: 999,
              background: "#1db954",
            }}
          />
          {appName}
        </span>
        <span style={{ display: "flex" }}>{periodLabel}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 24 }}>
        <span style={{ display: "flex", fontSize: 64, fontWeight: 800 }}>
          {ownerName}
        </span>
        <span
          style={{
            display: "flex",
            marginTop: 6,
            fontSize: 24,
            color: "#93a1b5",
          }}
        >
          {t("share.kicker")}
        </span>
      </div>

      <div style={{ display: "flex", gap: 64 }}>
        <Stat
          value={formatDuration(overview.totalMs, locale)}
          label={t("dash.listeningTime")}
        />
        <Stat
          value={formatNumber(overview.totalPlays, locale)}
          label={t("dash.metricPlays")}
        />
        <Stat
          value={formatNumber(overview.distinctArtists, locale)}
          label={t("dash.artists")}
        />
        <Stat
          value={formatNumber(overview.distinctTracks, locale)}
          label={t("dash.tracks")}
        />
      </div>

      <div style={{ display: "flex", gap: 48 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minWidth: 0,
          }}
        >
          <span style={{ display: "flex", fontSize: 16, color: "#93a1b5" }}>
            {t("dash.topArtists").toUpperCase()}
          </span>
          <span
            style={{
              display: "flex",
              marginTop: 4,
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            {topArtist}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minWidth: 0,
          }}
        >
          <span style={{ display: "flex", fontSize: 16, color: "#93a1b5" }}>
            {t("dash.topTracks").toUpperCase()}
          </span>
          <span
            style={{
              display: "flex",
              marginTop: 4,
              fontSize: 26,
              fontWeight: 600,
            }}
          >
            {topTrack}
          </span>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=600, s-maxage=600",
      },
    },
  );
}
