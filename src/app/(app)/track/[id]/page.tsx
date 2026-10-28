import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import type { StatsRange } from "@/lib/stats";
import { getTrackDetail } from "@/lib/stats/cached";
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
import {
  formatDateTime,
  formatDayShort,
  formatDuration,
  formatNumber,
} from "@/lib/format";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function TrackPage({
  params,
  searchParams,
}: PageProps<"/track/[id]">) {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const dayTitle = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "long",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));
  const { id } = await params;
  const sp = await searchParams;
  const parsed = parseRange(await resolveRangeParam(sp.range), user.timezone);
  const filters: StatsRange = {
    days: parsed.days,
    from: parsed.from,
    to: parsed.to,
  };

  const detail = await getTrackDetail(user.id, id, filters, user.timezone);
  if (!detail) notFound();

  const { track, overview } = detail;
  const dateFmt = (date: Date) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: user.timezone,
    }).format(date);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Cover
            src={track.imageUrl}
            alt={track.name}
            size={84}
            rounded="rounded-xl"
          />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted">
              {t("track.kicker")}
            </p>
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {track.name}
            </h1>
            <p className="mt-1 text-sm text-muted">
              <Link
                href={`/artist/${track.artist.id}`}
                className="hover:text-accent"
              >
                {track.artist.name}
              </Link>
              {track.album ? ` — ${track.album.name}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {track.durationMs ? (
                <Badge>{formatDuration(track.durationMs, locale)}</Badge>
              ) : null}
              {track.genres.slice(0, 3).map((genre) => (
                <Badge key={genre}>{genre}</Badge>
              ))}
              {track.isrc ? (
                <Badge tone="violet">ISRC {track.isrc}</Badge>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeTabs basePath={`/track/${track.id}`} current={parsed.key} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          label={t("track.plays")}
          value={formatNumber(overview.totalPlays, locale)}
          hint={formatDuration(overview.totalMs, locale)}
        />
        <StatCard
          label={t("artist.firstPlay")}
          value={overview.firstPlay ? dateFmt(overview.firstPlay) : "—"}
        />
        <StatCard
          label={t("track.lastPlay")}
          value={overview.lastPlay ? dateFmt(overview.lastPlay) : "—"}
        />
      </div>

      {overview.totalPlays === 0 ? (
        <EmptyState>{t("track.noPlays")}</EmptyState>
      ) : (
        <>
          <Card>
            <SectionTitle title={t("dash.overTime")} />
            <AreaChart
              points={detail.daily.map((d) => ({
                label: formatDayShort(d.day),
                value: d.msPlayed,
                title: dayTitle(d.day),
              }))}
            />
          </Card>

          <Card>
            <SectionTitle title={t("artist.recent")} />
            <ul className="divide-y divide-border">
              {detail.recent.map((play) => (
                <li key={play.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {play.artistName}
                    {play.albumName ? ` — ${play.albumName}` : ""}
                  </span>
                  <span className="text-right text-xs text-muted">
                    {formatDateTime(play.playedAt, user.timezone, locale)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
