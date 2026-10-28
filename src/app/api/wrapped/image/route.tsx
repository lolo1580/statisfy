import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getOptionalUser } from "@/lib/auth/dal";
import { fetchPublicUrl } from "@/lib/net";
import {
  getOverview,
  getTopArtists,
  getTopTracks,
  type Overview,
  type StatsRange,
  type TopArtist,
  type TopTrack,
} from "@/lib/stats";
import { formatPeriodLabel, parseWrappedPeriod } from "@/lib/period";
import { formatDuration, formatNumber } from "@/lib/format";
import { getI18n } from "@/i18n/server";
import { takeToken } from "@/lib/rate-limit-store";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Récupère une image distante publique et l'encode en data-URI. */
async function toDataUri(url?: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    // Anti-SSRF : refuse les schémas non http(s), les hôtes privés/locaux, et
    // revalide chaque redirection (un hôte public peut rediriger vers l'interne).
    const res = await fetchPublicUrl(url, {
      signal: AbortSignal.timeout(5_000),
      maxBytes: MAX_IMAGE_BYTES,
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > MAX_IMAGE_BYTES) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_IMAGE_BYTES) return null;
    return `data:${type};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

type StatLine = { plays: string; artists: string; tracks: string };

type CardProps = {
  user: string;
  locale: string;
  periodLabel: string;
  overview: Overview;
  stats: StatLine;
  artists: TopArtist[];
  tracks: TopTrack[];
  covers: (string | null)[];
  labels: {
    listeningTime: string;
    plays: string;
    artists: string;
    tracks: string;
  };
  playCount: (count: number) => string;
};

function Stat({
  label,
  value,
  size = 52,
}: {
  label: string;
  value: string;
  size?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: size, fontWeight: 800, display: "flex" }}>
        {value}
      </span>
      <span
        style={{
          fontSize: Math.round(size * 0.46),
          color: "#93a1b5",
          display: "flex",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function ArtistAvatar({
  artist,
  cover,
  size,
}: {
  artist: TopArtist;
  cover: string | null;
  size: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: size + 50,
      }}
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          width={size}
          height={size}
          alt=""
          style={{ borderRadius: 999, objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 999,
            background: "#1a222d",
          }}
        />
      )}
      <span
        style={{
          display: "flex",
          marginTop: 14,
          fontSize: Math.round(size * 0.16),
          fontWeight: 600,
        }}
      >
        {artist.name}
      </span>
    </div>
  );
}

function TrackList({
  tracks,
  playCount,
  fontSize,
  max,
}: {
  tracks: TopTrack[];
  playCount: (count: number) => string;
  fontSize: number;
  max: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      {tracks.slice(0, max).map((track, index) => (
        <div
          key={track.id}
          style={{
            display: "flex",
            width: "100%",
            fontSize,
            marginBottom: 14,
            alignItems: "center",
          }}
        >
          <span
            style={{
              display: "flex",
              color: "#19d18a",
              width: fontSize * 2,
              flexShrink: 0,
            }}
          >
            {index + 1}
          </span>
          <span
            style={{
              display: "flex",
              flexGrow: 1,
              flexShrink: 1,
              marginRight: 24,
            }}
          >
            {track.name} — {track.artistName}
          </span>
          <span
            style={{
              display: "flex",
              color: "#93a1b5",
              fontSize: Math.round(fontSize * 0.82),
              flexShrink: 0,
            }}
          >
            {playCount(track.plays)}
          </span>
        </div>
      ))}
    </div>
  );
}

function Header({ periodLabel }: { periodLabel: string }) {
  return (
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
  );
}

function Footer({ user }: { user: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 22,
        color: "#93a1b5",
      }}
    >
      <span style={{ display: "flex" }}>{user}</span>
      <span style={{ display: "flex" }}>Spotify</span>
    </div>
  );
}

function Hero({
  overview,
  stats,
  labels,
  locale,
  valueSize,
  statSize,
}: {
  overview: Overview;
  stats: StatLine;
  labels: CardProps["labels"];
  locale: string;
  valueSize: number;
  statSize: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 28, color: "#93a1b5", display: "flex" }}>
        {labels.listeningTime}
      </span>
      <span
        style={{
          fontSize: valueSize,
          fontWeight: 800,
          lineHeight: 1,
          display: "flex",
        }}
      >
        {formatDuration(overview.totalMs, locale)}
      </span>
      <div style={{ display: "flex", gap: 64, marginTop: 36 }}>
        <Stat label={labels.plays} value={stats.plays} size={statSize} />
        <Stat label={labels.artists} value={stats.artists} size={statSize} />
        <Stat label={labels.tracks} value={stats.tracks} size={statSize} />
      </div>
    </div>
  );
}

/** Carte carrée 1080×1080 (par défaut). */
function SquareCard(props: CardProps) {
  const {
    user,
    periodLabel,
    overview,
    stats,
    artists,
    tracks,
    covers,
    labels,
    locale,
    playCount,
  } = props;
  return (
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
      <Header periodLabel={periodLabel} />
      <Hero
        overview={overview}
        stats={stats}
        labels={labels}
        locale={locale}
        valueSize={110}
        statSize={48}
      />

      <div style={{ display: "flex", justifyContent: "center", gap: 48 }}>
        {artists.map((artist, index) => (
          <ArtistAvatar
            key={artist.id}
            artist={artist}
            cover={covers[index]}
            size={150}
          />
        ))}
      </div>

      <TrackList tracks={tracks} playCount={playCount} fontSize={26} max={5} />

      <Footer user={user} />
    </div>
  );
}

/** Carte verticale 1080×1920 (format « story »). */
function StoryCard(props: CardProps) {
  const {
    user,
    periodLabel,
    overview,
    stats,
    artists,
    tracks,
    covers,
    labels,
    locale,
    playCount,
  } = props;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: 80,
        background:
          "linear-gradient(160deg, #0a0d12 0%, #0f2a20 60%, #160f2a 100%)",
        color: "#eef2f7",
        fontFamily: "sans-serif",
      }}
    >
      <Header periodLabel={periodLabel} />
      <Hero
        overview={overview}
        stats={stats}
        labels={labels}
        locale={locale}
        valueSize={168}
        statSize={64}
      />

      <div style={{ display: "flex", justifyContent: "center", gap: 40 }}>
        {artists.map((artist, index) => (
          <ArtistAvatar
            key={artist.id}
            artist={artist}
            cover={covers[index]}
            size={210}
          />
        ))}
      </div>

      <TrackList tracks={tracks} playCount={playCount} fontSize={32} max={6} />

      <Footer user={user} />
    </div>
  );
}

export async function GET(request: NextRequest) {
  const user = await getOptionalUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  // Génération coûteuse (3 agrégations + rendu d'image + pochettes distantes) :
  // on borne les appels par compte pour éviter un déni de service interne.
  if (!takeToken(`wrapped-image:${user.id}`, 30, 60 * 1000)) {
    return new Response("Too many requests", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }
  const { locale, t } = await getI18n();
  const params = new URL(request.url).searchParams;
  const story = params.get("format") === "story";
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
    getTopTracks(user.id, filters, story ? 6 : 5),
  ]);

  const covers = await Promise.all(
    artists.map((artist) => toDataUri(artist.imageUrl)),
  );

  const periodLabel = formatPeriodLabel(period, locale, t("recap.yearLabel"));
  const playCount = (count: number) =>
    t("dash.playsCount", { count: formatNumber(count, locale) });

  const cardProps: CardProps = {
    user: user.name,
    locale,
    periodLabel,
    overview,
    stats: {
      plays: formatNumber(overview.totalPlays, locale),
      artists: formatNumber(overview.distinctArtists, locale),
      tracks: formatNumber(overview.distinctTracks, locale),
    },
    artists,
    tracks,
    covers,
    labels: {
      listeningTime: t("dash.listeningTime"),
      plays: t("recap.plays"),
      artists: t("recap.artists"),
      tracks: t("recap.tracks"),
    },
    playCount,
  };

  return new ImageResponse(
    story ? <StoryCard {...cardProps} /> : <SquareCard {...cardProps} />,
    story ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 },
  );
}
