import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import {
  getArtistTrends,
  getDailyStats,
  getHourlyStats,
  getOverview,
  getSourceBreakdown,
  getTopArtists,
  getTopGenres,
  getTopTracks,
  type StatsRange,
} from "@/lib/stats";
import { RangeTabs, SourceFilter } from "@/components/range-tabs";
import { parseRange, parseSource } from "@/lib/range";
import { AreaChart, BarsChart } from "@/components/charts";
import { Badge, Card, Cover, EmptyState, SectionTitle, StatCard } from "@/components/ui";
import { TopArtistsPanel, TopGenresPanel, TopTracksPanel } from "@/components/ranking-panels";
import { formatDuration, formatNumber } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

const dayLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const dayTitle = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
      new Date(`${iso}T00:00:00Z`),
    );
  const params = await searchParams;
  const parsed = parseRange(
    typeof params.range === "string" ? params.range : undefined,
    user.timezone,
  );
  const source = parseSource(
    typeof params.source === "string" ? params.source : undefined,
  );
  const filters: StatsRange = {
    days: parsed.days,
    from: parsed.from,
    to: parsed.to,
    source,
  };
  const query = `range=${parsed.key}${source ? `&source=${source}` : ""}`;

  const [overview, daily, hourly, topTracks, topArtists, topGenres, sources, trends] =
    await Promise.all([
      getOverview(user.id, filters),
      getDailyStats(user.id, user.timezone, filters),
      getHourlyStats(user.id, user.timezone, filters),
      getTopTracks(user.id, filters, 5),
      getTopArtists(user.id, filters, 5),
      getTopGenres(user.id, filters, 8),
      getSourceBreakdown(user.id, filters),
      getArtistTrends(user.id, filters, 4),
    ]);

  const isEmpty = overview.totalPlays === 0;
  const sourceLabel = (value: string) =>
    value === "spotify"
      ? t("source.spotify")
      : value === "import"
        ? t("source.import")
        : value;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("dash.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {overview.lastPlay
              ? t("dash.lastPlay", {
                  date: new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: user.timezone,
                  }).format(overview.lastPlay),
                })
              : t("dash.noPlays")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeTabs basePath="/dashboard" current={parsed.key} source={source} />
          <SourceFilter
            basePath="/dashboard"
            current={source}
            rangeKey={parsed.key}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t("dash.listeningTime")}
          value={formatDuration(overview.totalMs)}
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

      {sources.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {sources.map((entry) => (
            <span
              key={entry.source}
              className="rounded-full border border-border bg-surface/70 px-3 py-1 text-xs text-muted"
            >
              {t("dash.sourceChip", {
                label: sourceLabel(entry.source),
                plays: formatNumber(entry.plays, locale),
                duration: formatDuration(entry.msPlayed),
              })}
            </span>
          ))}
        </div>
      ) : null}

      {isEmpty ? (
        <EmptyState>
          {t("dash.empty")}{" "}
          <Link href="/settings" className="text-accent hover:underline">
            {t("nav.settings")}
          </Link>
        </EmptyState>
      ) : (
        <>
          <Card>
            <SectionTitle title={t("dash.overTime")} subtitle={t("dash.dailyTime")} />
            <AreaChart
              points={daily.map((d) => ({
                label: dayLabel(d.day),
                value: d.msPlayed,
                title: dayTitle(d.day),
              }))}
            />
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <TopTracksPanel
                title={t("dash.topTracks")}
                items={topTracks}
                query={query}
                empty={t("dash.noTracks")}
              />
            </Card>

            <Card>
              <TopArtistsPanel
                title={t("dash.topArtists")}
                items={topArtists}
                query={query}
                empty={t("dash.noArtists")}
              />
            </Card>

            <Card>
              <TopGenresPanel
                title={t("dash.genres")}
                subtitle={t("dash.genresWeighted")}
                items={topGenres}
                empty={t("dash.genresUnavailable")}
              />
            </Card>
          </div>

          <Card>
            <SectionTitle
              title={t("dash.whenListen")}
              subtitle={t("dash.byHour")}
            />
            <BarsChart
              bars={hourly.map((h) => ({
                label: `${String(h.hour).padStart(2, "0")}h`,
                value: h.plays,
                title: t("dash.playsCount", {
                  count: formatNumber(h.plays, locale),
                }),
              }))}
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted">
              <span>00h</span>
              <span>06h</span>
              <span>12h</span>
              <span>18h</span>
              <span>23h</span>
            </div>
          </Card>

          {trends.hasPrevious &&
          (trends.rising.length > 0 || trends.falling.length > 0) ? (
            <Card>
              <SectionTitle
                title={t("dash.trends")}
                subtitle={t("dash.trendsSubtitle", { days: parsed.days ?? "" })}
              />
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wider text-muted">
                    {t("dash.rising")}
                  </p>
                  <ul className="space-y-1">
                    {trends.rising.map((artist) => (
                      <li key={artist.id}>
                        <Link
                          href={`/artist/${artist.id}`}
                          className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-surface-2"
                        >
                          <Cover
                            src={artist.imageUrl}
                            alt={artist.name}
                            size={34}
                            rounded="rounded-full"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {artist.name}
                          </span>
                          <Badge tone="accent">
                            +{formatNumber(artist.delta, locale)}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wider text-muted">
                    {t("dash.falling")}
                  </p>
                  <ul className="space-y-1">
                    {trends.falling.map((artist) => (
                      <li key={artist.id}>
                        <Link
                          href={`/artist/${artist.id}`}
                          className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-surface-2"
                        >
                          <Cover
                            src={artist.imageUrl}
                            alt={artist.name}
                            size={34}
                            rounded="rounded-full"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {artist.name}
                          </span>
                          <Badge tone="danger">
                            {formatNumber(artist.delta, locale)}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
