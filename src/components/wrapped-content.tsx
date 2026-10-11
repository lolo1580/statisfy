import Link from "next/link";
import type { ReactNode } from "react";
import {
  getDiscoveredArtists,
  getOverview,
  getTopAlbums,
  getTopArtists,
  getTopGenres,
  getTopTracks,
  getWrappedExtras,
  type StatsRange,
} from "@/lib/stats";
import {
  formatPeriodLabel,
  monthShortNames,
  type WrappedPeriod,
} from "@/lib/period";
import { AreaChart, BarsChart, RankBars } from "@/components/charts";
import {
  Badge,
  Card,
  Cover,
  EmptyState,
  SectionTitle,
  StatCard,
} from "@/components/ui";
import { formatDuration, formatNumber } from "@/lib/format";
import { getI18n } from "@/i18n/server";

/** Enveloppe : lien vers la fiche (connecté) ou simple bloc (partage public). */
function MaybeLink({
  href,
  interactive,
  className,
  children,
}: {
  href: string;
  interactive: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (interactive) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return <div className={className}>{children}</div>;
}

/**
 * Corps du récapitulatif, partagé entre la page connectée (`/wrapped`) et la
 * page publique (`/share/wrapped/[token]`). Le rendu est identique ; seuls les
 * liens internes sont désactivés en mode public.
 */
export async function WrappedContent({
  userId,
  timezone,
  period,
  interactive = false,
}: {
  userId: string;
  timezone: string;
  period: WrappedPeriod;
  interactive?: boolean;
}) {
  const { locale, t } = await getI18n();

  const filters: StatsRange = { days: null, from: period.from, to: period.to };
  const prevFilters: StatsRange = {
    days: null,
    from: period.prevFrom,
    to: period.prevTo,
  };

  const [
    overview,
    previous,
    topTracks,
    topArtists,
    topAlbums,
    topGenres,
    extras,
    discovered,
  ] = await Promise.all([
    getOverview(userId, filters),
    getOverview(userId, prevFilters),
    getTopTracks(userId, filters, 10),
    getTopArtists(userId, filters, 5),
    getTopAlbums(userId, filters, 5),
    getTopGenres(userId, filters, 8),
    getWrappedExtras(userId, timezone, filters),
    getDiscoveredArtists(userId, filters, 5),
  ]);

  const periodLabel = formatPeriodLabel(period, locale, t("recap.yearLabel"));
  const monthsShort = monthShortNames(locale);

  const delta =
    previous.totalMs > 0
      ? Math.round(
          ((overview.totalMs - previous.totalMs) / previous.totalMs) * 100,
        )
      : null;

  const dateFmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: timezone,
  });

  const chartPoints = period.isMonth
    ? extras.daily.map((bucket) => ({
        label: `${bucket.key.slice(8, 10)}/${bucket.key.slice(5, 7)}`,
        value: bucket.msPlayed,
      }))
    : extras.monthly.map((bucket) => ({
        label: monthsShort[Number(bucket.key.slice(5, 7)) - 1],
        value: bucket.msPlayed,
      }));

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-accent-soft to-transparent">
        <p className="text-xs uppercase tracking-wider text-muted">
          {t("recap.heroKicker", {
            period: t(period.isMonth ? "recap.periodMonth" : "recap.periodYear"),
          })}
        </p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">
          {periodLabel}
        </h2>
        <div className="mt-5 flex flex-wrap items-end gap-x-10 gap-y-4">
          <div>
            <div className="text-4xl font-bold tracking-tight">
              {formatDuration(overview.totalMs, locale)}
            </div>
            <div className="text-sm text-muted">{t("recap.listening")}</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">
              {formatNumber(overview.totalPlays, locale)}
            </div>
            <div className="text-sm text-muted">{t("recap.plays")}</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">
              {formatNumber(overview.distinctArtists, locale)}
            </div>
            <div className="text-sm text-muted">{t("recap.artists")}</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">
              {formatNumber(overview.distinctTracks, locale)}
            </div>
            <div className="text-sm text-muted">{t("recap.tracks")}</div>
          </div>
          {delta !== null ? (
            <Badge tone={delta >= 0 ? "accent" : "danger"}>
              {t("recap.delta", { value: `${delta >= 0 ? "+" : ""}${delta}` })}
            </Badge>
          ) : null}
        </div>
      </Card>

      {overview.totalPlays === 0 ? (
        <EmptyState>
          {t("recap.noData")}{" "}
          {interactive ? (
            <Link href="/settings" className="text-accent hover:underline">
              {t("nav.settings")}
            </Link>
          ) : null}
        </EmptyState>
      ) : (
        <>
          <Card>
            <SectionTitle
              title={
                period.isMonth ? t("recap.daily") : t("recap.monthlyProgress")
              }
              subtitle={t("dash.listeningTime")}
            />
            {period.isMonth ? (
              <AreaChart points={chartPoints} />
            ) : (
              <BarsChart bars={chartPoints} variant="duration" />
            )}
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t("recap.busiestDay")}
              value={
                extras.busiestDay
                  ? dateFmt.format(new Date(`${extras.busiestDay.key}T12:00:00Z`))
                  : "—"
              }
              hint={
                extras.busiestDay
                  ? formatDuration(extras.busiestDay.msPlayed, locale)
                  : undefined
              }
            />
            <StatCard
              label={t("recap.favoriteHour")}
              value={
                extras.busiestHour
                  ? `${String(extras.busiestHour.hour).padStart(2, "0")}h`
                  : "—"
              }
              hint={
                extras.busiestHour
                  ? t("dash.playsCount", {
                      count: formatNumber(extras.busiestHour.plays, locale),
                    })
                  : undefined
              }
            />
            <StatCard
              label={t("recap.activeDays")}
              value={formatNumber(extras.activeDays, locale)}
            />
            <StatCard
              label={t("recap.discovered")}
              value={formatNumber(discovered.count, locale)}
              hint={
                discovered.artists.length > 0
                  ? discovered.artists.map((a) => a.name).join(", ")
                  : undefined
              }
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <SectionTitle
                title={t("recap.yourArtists")}
                subtitle={t("recap.top5Period")}
              />
              {topArtists.length === 0 ? (
                <EmptyState>{t("generic.noData")}</EmptyState>
              ) : (
                <div className="grid grid-cols-5 gap-3">
                  {topArtists.map((artist) => (
                    <MaybeLink
                      key={artist.id}
                      href={`/artist/${artist.id}`}
                      interactive={interactive}
                      className="min-w-0 text-center"
                    >
                      <Cover
                        src={artist.imageUrl}
                        alt={artist.name}
                        size={96}
                        rounded="rounded-full"
                      />
                      <p className="mt-2 truncate text-xs font-medium">
                        {artist.name}
                      </p>
                      <p className="truncate text-[10px] text-muted">
                        {formatDuration(artist.msPlayed, locale)}
                      </p>
                    </MaybeLink>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <SectionTitle
                title={t("recap.yourGenres")}
                subtitle={t("recap.genresWeighted")}
              />
              {topGenres.length === 0 ? (
                <EmptyState>{t("dash.genresUnavailable")}</EmptyState>
              ) : (
                <RankBars
                  items={topGenres.map((g) => ({
                    label: g.genre,
                    value: g.plays,
                  }))}
                />
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <SectionTitle
                title={t("recap.yourTracks")}
                subtitle={t("recap.top10")}
              />
              <ol className="space-y-1">
                {topTracks.map((track, index) => (
                  <li key={track.id}>
                    <MaybeLink
                      href={`/track/${track.id}`}
                      interactive={interactive}
                      className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-surface-2"
                    >
                      <span className="w-5 text-sm text-muted">{index + 1}</span>
                      <Cover src={track.imageUrl} alt={track.name} size={38} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {track.name}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {track.artistName}
                        </p>
                      </div>
                      <span className="text-xs text-muted">
                        {formatDuration(track.msPlayed, locale)}
                      </span>
                    </MaybeLink>
                  </li>
                ))}
              </ol>
            </Card>

            <Card>
              <SectionTitle
                title={t("recap.yourAlbums")}
                subtitle={t("recap.top5")}
              />
              {topAlbums.length === 0 ? (
                <EmptyState>{t("generic.noData")}</EmptyState>
              ) : (
                <div className="grid grid-cols-5 gap-3">
                  {topAlbums.map((album) => (
                    <div key={album.id} className="min-w-0">
                      <Cover
                        src={album.imageUrl}
                        alt={album.name}
                        size={96}
                        rounded="rounded-xl"
                      />
                      <p className="mt-2 truncate text-xs font-medium">
                        {album.name}
                      </p>
                      <p className="truncate text-[10px] text-muted">
                        {album.artistName}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
