import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import {
  getDailyStats,
  getListeningBehavior,
  getRecentPlays,
  getTimelineStats,
  getWeeklyHourStats,
  type StatsRange,
} from "@/lib/stats";
import { RangeTabs } from "@/components/range-tabs";
import { parseRange } from "@/lib/range";
import { resolveRangeParam } from "@/lib/range-preference";
import {
  AreaChart,
  BarsChart,
  Heatmap,
  RankBars,
  WeekdayHourHeatmap,
} from "@/components/charts";
import { Card, Cover, EmptyState, SectionTitle } from "@/components/ui";
import { formatDateTime, formatDuration, formatNumber } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

const dayLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

/** Petit indicateur de pourcentage (saut, aléatoire, hors ligne). */
function RateStat({
  label,
  rate,
  locale,
}: {
  label: string;
  rate: number | null;
  locale: string;
}) {
  const display =
    rate === null
      ? "—"
      : new Intl.NumberFormat(locale, {
          style: "percent",
          maximumFractionDigits: 0,
        }).format(rate);
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{display}</p>
    </div>
  );
}

export default async function HistoryPage({
  searchParams,
}: PageProps<"/history">) {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const dayTitle = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
      new Date(`${iso}T00:00:00Z`),
    );
  const params = await searchParams;
  const parsed = parseRange(
    await resolveRangeParam(params.range),
    user.timezone,
  );
  const filters: StatsRange = {
    days: parsed.days,
    from: parsed.from,
    to: parsed.to,
  };

  const [timeline, recent, heatmap, weeklyHour, behavior] = await Promise.all([
    getTimelineStats(user.id, user.timezone, filters),
    getRecentPlays(user.id, filters, 50),
    getDailyStats(user.id, user.timezone, { days: 371 }),
    getWeeklyHourStats(user.id, user.timezone, filters),
    getListeningBehavior(user.id),
  ]);
  const { daily, hourly } = timeline;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("history.title")}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <RangeTabs basePath="/history" current={parsed.key} />
        </div>
      </div>

      <Card>
        <SectionTitle
          title={t("history.heatmap")}
          subtitle={t("history.heatmapSubtitle")}
        />
        <Heatmap days={heatmap.map((d) => ({ day: d.day, plays: d.plays }))} />
      </Card>

      <Card>
        <SectionTitle title={t("history.daily")} />
        <AreaChart
          points={daily.map((d) => ({
            label: dayLabel(d.day),
            value: d.msPlayed,
            title: dayTitle(d.day),
          }))}
        />
      </Card>

      <Card>
        <SectionTitle
          title={t("history.hourly")}
          subtitle={t("history.hourlySubtitle")}
        />
        <BarsChart
          variant="duration"
          bars={hourly.hours.map((h) => {
            const avgMs =
              hourly.activeDays > 0 ? h.msPlayed / hourly.activeDays : 0;
            return {
              label: `${String(h.hour).padStart(2, "0")}h`,
              value: avgMs,
              title: `${formatDuration(avgMs, locale)} ${t("dash.avgPerDay")}`,
            };
          })}
        />
      </Card>

      <Card>
        <SectionTitle
          title={t("history.weekdayHour")}
          subtitle={t("history.weekdayHourSubtitle")}
        />
        <WeekdayHourHeatmap grid={weeklyHour.grid} max={weeklyHour.max} />
      </Card>

      {behavior.sample > 0 ? (
        <Card>
          <SectionTitle
            title={t("history.behavior")}
            subtitle={t("history.behaviorSubtitle")}
          />
          <div className="grid grid-cols-3 gap-4">
            <RateStat
              label={t("history.skipRate")}
              rate={behavior.skippedRate}
              locale={locale}
            />
            <RateStat
              label={t("history.shuffleRate")}
              rate={behavior.shuffleRate}
              locale={locale}
            />
            <RateStat
              label={t("history.offlineRate")}
              rate={behavior.offlineRate}
              locale={locale}
            />
          </div>
          {behavior.platforms.length > 0 ? (
            <div className="mt-5">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
                {t("history.topPlatforms")}
              </p>
              <RankBars
                items={behavior.platforms.map((p) => ({
                  label: p.platform,
                  value: p.plays,
                  display: formatNumber(p.plays, locale),
                }))}
              />
            </div>
          ) : null}
          <p className="mt-4 text-xs text-muted">
            {t("history.behaviorSample", {
              count: formatNumber(behavior.sample, locale),
            })}
          </p>
        </Card>
      ) : null}

      <Card>
        <SectionTitle title={t("history.recent")} />
        {recent.length === 0 ? (
          <EmptyState>{t("history.noPlays")}</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((play) => (
              <li key={play.id} className="flex items-center gap-3 py-2.5">
                <Link href={`/track/${play.trackId}`} className="shrink-0">
                  <Cover src={play.imageUrl} alt={play.trackName} size={38} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/track/${play.trackId}`}
                    className="truncate text-sm font-medium hover:text-accent"
                  >
                    {play.trackName}
                  </Link>
                  <p className="truncate text-xs text-muted">
                    <Link
                      href={`/artist/${play.artistId}`}
                      className="hover:text-accent"
                    >
                      {play.artistName}
                    </Link>
                    {play.albumName ? ` — ${play.albumName}` : ""}
                  </p>
                </div>
                <div className="hidden text-right text-xs text-muted sm:block">
                  {formatDateTime(play.playedAt, user.timezone, locale)}
                </div>
                <span className="hidden w-16 text-right text-xs text-muted md:inline">
                  {formatDuration(play.msPlayed, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
