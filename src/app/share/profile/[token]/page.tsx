import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSharedProfile } from "@/lib/profile-share";
import {
  getDailyStats,
  getOverview,
  getRecentPlays,
  getTopArtists,
  getTopTracks,
  type StatsRange,
  type TopArtist,
  type TopTrack,
} from "@/lib/stats";
import { parseRange } from "@/lib/range";
import { RangeTabs } from "@/components/range-tabs";
import { Heatmap } from "@/components/charts";
import { Card, Cover, EmptyState, SectionTitle, StatCard } from "@/components/ui";
import { formatDateTime, formatDuration, formatNumber } from "@/lib/format";
import { getI18n } from "@/i18n/server";
import { appName } from "@/lib/env";

export const dynamic = "force-dynamic";

// Lien non répertorié : on demande aux moteurs de ne pas l'indexer.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Profil public (opt-in) : mêmes statistiques que le tableau de bord, mais en
 * lecture seule et avec les sections choisies par le propriétaire.
 */
export default async function SharedProfilePage({
  params,
  searchParams,
}: PageProps<"/share/profile/[token]">) {
  const { token } = await params;
  const owner = await getSharedProfile(token);
  if (!owner) notFound();

  const { config } = owner;
  const { locale, t } = await getI18n();
  const sp = await searchParams;
  const parsed = parseRange(
    typeof sp.range === "string" ? sp.range : "30",
    owner.timezone,
  );
  const filters: StatsRange = {
    days: parsed.days,
    from: parsed.from,
    to: parsed.to,
  };
  const basePath = `/share/profile/${token}`;

  const noArtists: TopArtist[] = [];
  const noTracks: TopTrack[] = [];

  const [overview, artists, tracks, recent, heatmap] = await Promise.all([
    getOverview(owner.id, filters),
    config.topArtists
      ? getTopArtists(owner.id, filters, 5)
      : Promise.resolve(noArtists),
    config.topTracks
      ? getTopTracks(owner.id, filters, 5)
      : Promise.resolve(noTracks),
    config.recentPlays ? getRecentPlays(owner.id, filters, 10) : Promise.resolve([]),
    config.heatmap
      ? getDailyStats(owner.id, owner.timezone, { days: 371 })
      : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold tracking-tight transition-colors hover:text-accent"
          >
            <span aria-hidden>🎧</span>
            {appName}
          </Link>
          <p className="text-xs uppercase tracking-wider text-muted">
            {t("profile.kicker")}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{owner.name}</h1>
          <p className="mt-1 text-sm text-muted">{t("profile.subtitle")}</p>
        </div>
        <RangeTabs basePath={basePath} current={parsed.key} />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("dash.listeningTime")}
          value={formatDuration(overview.totalMs, locale)}
          hint={t("dash.playsCount", {
            count: formatNumber(overview.totalPlays, locale),
          })}
        />
        <StatCard
          label={t("dash.artists")}
          value={formatNumber(overview.distinctArtists, locale)}
        />
        <StatCard
          label={t("dash.tracks")}
          value={formatNumber(overview.distinctTracks, locale)}
        />
        <StatCard
          label={t("dash.albums")}
          value={formatNumber(overview.distinctAlbums, locale)}
        />
      </div>

      {config.topArtists || config.topTracks ? (
        <div
          className={`mt-6 grid gap-6 ${
            config.topArtists && config.topTracks ? "lg:grid-cols-2" : ""
          }`}
        >
          {config.topArtists ? (
            <Card>
              <SectionTitle title={t("dash.topArtists")} />
              {artists.length === 0 ? (
                <EmptyState>{t("dash.noArtists")}</EmptyState>
              ) : (
                <ol className="space-y-2">
                  {artists.map((artist, index) => (
                    <li key={artist.id} className="flex items-center gap-3">
                      <span className="w-5 text-right text-sm text-muted">
                        {index + 1}
                      </span>
                      <Cover
                        src={artist.imageUrl}
                        alt={artist.name}
                        size={40}
                        rounded="rounded-full"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {artist.name}
                      </span>
                      <span className="text-sm text-muted">
                        {t("dash.playsCount", {
                          count: formatNumber(artist.plays, locale),
                        })}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          ) : null}

          {config.topTracks ? (
            <Card>
              <SectionTitle title={t("dash.topTracks")} />
              {tracks.length === 0 ? (
                <EmptyState>{t("dash.noTracks")}</EmptyState>
              ) : (
                <ol className="space-y-2">
                  {tracks.map((track, index) => (
                    <li key={track.id} className="flex items-center gap-3">
                      <span className="w-5 text-right text-sm text-muted">
                        {index + 1}
                      </span>
                      <Cover src={track.imageUrl} alt={track.name} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {track.name}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {track.artistName}
                        </span>
                      </span>
                      <span className="text-sm text-muted">
                        {t("dash.playsCount", {
                          count: formatNumber(track.plays, locale),
                        })}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          ) : null}
        </div>
      ) : null}

      {config.recentPlays ? (
        <Card className="mt-6">
          <SectionTitle title={t("profile.recent")} />
          {recent.length === 0 ? (
            <EmptyState>{t("history.noPlays")}</EmptyState>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {recent.map((play) => (
                <li
                  key={play.id}
                  className="flex flex-wrap items-center gap-3 py-2"
                >
                  <Cover src={play.imageUrl} alt={play.trackName} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {play.trackName}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {play.artistName}
                    </span>
                  </span>
                  <span className="text-xs text-muted">
                    {formatDateTime(play.playedAt, owner.timezone, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {config.heatmap ? (
        <Card className="mt-6">
          <SectionTitle
            title={t("history.heatmap")}
            subtitle={t("history.heatmapSubtitle")}
          />
          <Heatmap days={heatmap.map((day) => ({ day: day.day, plays: day.plays }))} />
        </Card>
      ) : null}

      <footer className="mt-10 border-t border-border pt-4 text-xs text-muted">
        <Link href="/" className="transition-colors hover:text-accent">
          {t("share.footer", { name: appName })}
        </Link>
      </footer>
    </main>
  );
}
