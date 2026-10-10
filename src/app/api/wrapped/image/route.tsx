import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import {
  getOverview,
  getTopArtists,
  getTopTracks,
  type StatsRange,
} from "@/lib/stats";
import { formatPeriodLabel, parseWrappedPeriod } from "@/lib/period";
import { formatDuration, formatNumber } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/** Récupère une image distante et l'encode en data-URI (pas de souci CORS). */
async function toDataUri(url?: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${type};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 52, fontWeight: 800, display: "flex" }}>
        {value}
      </span>
      <span style={{ fontSize: 24, color: "#93a1b5", display: "flex" }}>
        {label}
      </span>
    </div>
  );
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const params = new URL(request.url).searchParams;
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
    getOverview(user.id, filters),
    getTopArtists(user.id, filters, 3),
    getTopTracks(user.id, filters, 5),
  ]);

  const covers = await Promise.all(
    artists.map((artist) => toDataUri(artist.imageUrl)),
  );

  const host = new URL(request.url).host;
  const periodLabel = formatPeriodLabel(period, locale, t("recap.yearLabel"));
  const playCount = (count: number) =>
    t("dash.playsCount", { count: formatNumber(count, locale) });

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: 64,
          background: "linear-gradient(135deg, #0a0d12 0%, #0f2a20 100%)",
          color: "#eef2f7",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 40, fontWeight: 800, display: "flex" }}>
            Statisfy
          </span>
          <span style={{ fontSize: 34, color: "#19d18a", display: "flex" }}>
            {periodLabel}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 26, color: "#93a1b5", display: "flex" }}>
            {t("dash.listeningTime")}
          </span>
          <span
            style={{
              fontSize: 120,
              fontWeight: 800,
              lineHeight: 1,
              display: "flex",
            }}
          >
            {formatDuration(overview.totalMs)}
          </span>
          <div style={{ display: "flex", gap: 64, marginTop: 32 }}>
            <Stat
              label={t("recap.plays")}
              value={formatNumber(overview.totalPlays, locale)}
            />
            <Stat
              label={t("recap.artists")}
              value={formatNumber(overview.distinctArtists, locale)}
            />
            <Stat
              label={t("recap.tracks")}
              value={formatNumber(overview.distinctTracks, locale)}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 48 }}>
          {artists.map((artist, index) => (
            <div
              key={artist.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: 200,
              }}
            >
              {covers[index] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={covers[index] as string}
                  width={150}
                  height={150}
                  alt=""
                  style={{ borderRadius: 999, objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: 150,
                    height: 150,
                    borderRadius: 999,
                    background: "#1a222d",
                  }}
                />
              )}
              <span
                style={{
                  display: "flex",
                  marginTop: 12,
                  fontSize: 24,
                  fontWeight: 600,
                }}
              >
                {artist.name}
              </span>
              <span style={{ display: "flex", fontSize: 18, color: "#93a1b5" }}>
                {playCount(artist.plays)}
              </span>
            </div>
          ))}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "center",
            }}
          >
            {tracks.map((track, index) => (
              <div
                key={track.id}
                style={{ display: "flex", fontSize: 24, marginBottom: 10 }}
              >
                <span style={{ display: "flex", color: "#19d18a", width: 44 }}>
                  {index + 1}
                </span>
                <span style={{ display: "flex" }}>
                  {track.name} — {track.artistName}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#93a1b5",
          }}
        >
          <span style={{ display: "flex" }}>{user.name}</span>
          <span style={{ display: "flex" }}>{host}</span>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}
