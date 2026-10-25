import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { getArtistDetail, type StatsRange } from "@/lib/stats";
import { RangeTabs } from "@/components/range-tabs";
import { parseRange } from "@/lib/range";
import { resolveRangeParam } from "@/lib/range-preference";
import { AreaChart } from "@/components/charts";
import {
  Badge,
  Card,
  Cover,
  EmptyState,
  SectionTitle,
  StatCard,
} from "@/components/ui";
import { formatDate, formatDateTime, formatDuration, formatNumber } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

const dayLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

export default async function ArtistPage({
  params,
  searchParams,
}: PageProps<"/artist/[id]">) {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const dayTitle = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
      new Date(`${iso}T00:00:00Z`),
    );
  const { id } = await params;
  const sp = await searchParams;
  const parsed = parseRange(await resolveRangeParam(sp.range), user.timezone);
  const filters: StatsRange = {
    days: parsed.days,
    from: parsed.from,
    to: parsed.to,
  };

  const detail = await getArtistDetail(user.id, id, filters, user.timezone);
  if (!detail) notFound();

  const { artist, overview } = detail;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Cover
            src={artist.imageUrl}
            alt={artist.name}
            size={84}
            rounded="rounded-full"
          />
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">
              {t("artist.kicker")}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {artist.name}
            </h1>
            {artist.genres.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {artist.genres.slice(0, 5).map((genre) => (
                  <Badge key={genre}>{genre}</Badge>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeTabs basePath={`/artist/${artist.id}`} current={parsed.key} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t("dash.listeningTime")}
          value={formatDuration(overview.totalMs, locale)}
          hint={t("dash.playsCount", {
            count: formatNumber(overview.totalPlays, locale),
          })}
        />
        <StatCard
          label={t("artist.distinctTracks")}
          value={formatNumber(overview.distinctTracks, locale)}
        />
        <StatCard
          label={t("artist.distinctAlbums")}
          value={formatNumber(overview.distinctAlbums, locale)}
        />
        <StatCard
          label={t("artist.firstPlay")}
          value={
            overview.firstPlay
              ? formatDate(overview.firstPlay, user.timezone, locale)
              : "—"
          }
          hint={
            overview.lastPlay
              ? t("artist.lastPlayHint", {
                  date: formatDate(overview.lastPlay, user.timezone, locale),
                })
              : undefined
          }
        />
      </div>

      {overview.totalPlays === 0 ? (
        <EmptyState>{t("artist.noPlays")}</EmptyState>
      ) : (
        <Card>
          <SectionTitle title={t("dash.overTime")} />
          <AreaChart
            points={detail.daily.map((d) => ({
              label: dayLabel(d.day),
              value: d.msPlayed,
              title: dayTitle(d.day),
            }))}
          />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle title={t("top.topTracks")} />
          {detail.topTracks.length === 0 ? (
            <EmptyState>{t("generic.noData")}</EmptyState>
          ) : (
            <ol className="space-y-1">
              {detail.topTracks.map((track, index) => (
                <li key={track.id}>
                  <Link
                    href={`/track/${track.id}?range=${parsed.key}`}
                    className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-surface-2"
                  >
                    <span className="w-5 text-sm text-muted">{index + 1}</span>
                    <Cover src={track.imageUrl} alt={track.name} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {track.name}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {track.albumName ?? "—"}
                      </p>
                    </div>
                    <span className="text-xs text-muted">
                      {formatDuration(track.msPlayed, locale)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <SectionTitle title={t("artist.albums")} />
          {detail.topAlbums.length === 0 ? (
            <EmptyState>{t("generic.noData")}</EmptyState>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {detail.topAlbums.map((album) => (
                <div key={album.id} className="min-w-0">
                  <Cover
                    src={album.imageUrl}
                    alt={album.name}
                    size={96}
                    rounded="rounded-xl"
                  />
                  <p className="mt-2 truncate text-sm font-medium">
                    {album.name}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {formatDuration(album.msPlayed, locale)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle title={t("artist.recent")} />
        {detail.recent.length === 0 ? (
          <EmptyState>{t("artist.noRecent")}</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {detail.recent.map((play) => (
              <li key={play.id} className="flex items-center gap-3 py-2.5">
                <Link href={`/track/${play.trackId}`} className="shrink-0">
                  <Cover src={play.imageUrl} alt={play.trackName} size={36} />
                </Link>
                <Link
                  href={`/track/${play.trackId}`}
                  className="min-w-0 flex-1 truncate text-sm hover:text-accent"
                >
                  {play.trackName}
                </Link>
                <span className="hidden text-right text-xs text-muted sm:block">
                  {formatDateTime(play.playedAt, user.timezone, locale)}
                </span>
                <Badge>{formatDuration(play.msPlayed, locale)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
