import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import {
  getDailyStats,
  getHourlyStats,
  getRecentPlays,
  getSourceBreakdown,
  type StatsRange,
} from "@/lib/stats";
import { RangeTabs, SourceFilter } from "@/components/range-tabs";
import { parseRange, parseSource } from "@/lib/range";
import { AreaChart, BarsChart, Heatmap } from "@/components/charts";
import { Badge, Card, Cover, EmptyState, SectionTitle } from "@/components/ui";
import { formatDateTime, formatDuration, formatNumber } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

const dayLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

const SOURCE_TONES: Record<string, "accent" | "violet" | "neutral"> = {
  spotify: "accent",
  import: "neutral",
};

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

  const [daily, hourly, recent, sources, heatmap] = await Promise.all([
    getDailyStats(user.id, user.timezone, filters),
    getHourlyStats(user.id, user.timezone, filters),
    getRecentPlays(user.id, filters, 50),
    getSourceBreakdown(user.id, filters),
    getDailyStats(user.id, user.timezone, { days: 371, source }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("history.title")}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <RangeTabs basePath="/history" current={parsed.key} source={source} />
          <SourceFilter
            basePath="/history"
            current={source}
            rangeKey={parsed.key}
          />
        </div>
      </div>

      {sources.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {sources.map((entry) => (
            <Badge key={entry.source} tone="violet">
              {entry.source} · {formatNumber(entry.plays, locale)}
            </Badge>
          ))}
        </div>
      ) : null}

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
          bars={hourly.map((h) => ({
            label: `${String(h.hour).padStart(2, "0")}h`,
            value: h.plays,
            title: t("dash.playsCount", {
              count: formatNumber(h.plays, locale),
            }),
          }))}
        />
      </Card>

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
                <Badge tone={SOURCE_TONES[play.source] ?? "neutral"}>
                  {play.source}
                </Badge>
                <span className="hidden w-16 text-right text-xs text-muted md:inline">
                  {formatDuration(play.msPlayed)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
