import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import {
  getOverview,
  getPlayingYears,
  getTopArtists,
  getTopGenres,
  getTopTracks,
  getWrappedExtras,
  type StatsRange,
} from "@/lib/stats";
import { comparisonSeries, percentChange } from "@/lib/compare";
import {
  formatPeriodLabel,
  monthNames,
  monthShortNames,
  parseWrappedPeriod,
  type WrappedPeriod,
} from "@/lib/period";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { CompareChart } from "@/components/charts";
import {
  TopArtistsPanel,
  TopGenresPanel,
  TopTracksPanel,
} from "@/components/ranking-panels";
import { formatDuration, formatNumber } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

const selectClass =
  "rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent";

const asString = (value: unknown) =>
  typeof value === "string" ? value : undefined;

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted">—</span>;
  return (
    <Badge tone={value >= 0 ? "accent" : "danger"}>
      {value >= 0 ? "+" : ""}
      {value}%
    </Badge>
  );
}

function PeriodSelect({
  title,
  yearName,
  monthName,
  period,
  yearOptions,
  monthsLong,
  wholeYearLabel,
}: {
  title: string;
  yearName: string;
  monthName: string;
  period: WrappedPeriod;
  yearOptions: number[];
  monthsLong: string[];
  wholeYearLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-muted">
        {title}
      </span>
      <span className="flex gap-2">
        <select name={yearName} defaultValue={period.year} className={selectClass}>
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <select
          name={monthName}
          defaultValue={period.month ?? 0}
          className={selectClass}
        >
          <option value={0}>{wholeYearLabel}</option>
          {monthsLong.map((name, index) => (
            <option key={name} value={index + 1}>
              {name}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
}

export default async function ComparePage({
  searchParams,
}: PageProps<"/compare">) {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const sp = await searchParams;

  const periodA = parseWrappedPeriod(asString(sp.ay), asString(sp.am));
  const periodB = parseWrappedPeriod(
    asString(sp.by) ?? String(periodA.year - 1),
    asString(sp.bm),
  );

  const filtersA: StatsRange = {
    days: null,
    from: periodA.from,
    to: periodA.to,
  };
  const filtersB: StatsRange = {
    days: null,
    from: periodB.from,
    to: periodB.to,
  };

  const [
    years,
    overviewA,
    overviewB,
    extrasA,
    extrasB,
    artistsAByPlays,
    artistsAByTime,
    artistsBByPlays,
    artistsBByTime,
    tracksAByPlays,
    tracksAByTime,
    tracksBByPlays,
    tracksBByTime,
    genresAByPlays,
    genresAByTime,
    genresBByPlays,
    genresBByTime,
  ] = await Promise.all([
    getPlayingYears(user.id),
    getOverview(user.id, filtersA),
    getOverview(user.id, filtersB),
    getWrappedExtras(user.id, user.timezone, filtersA),
    getWrappedExtras(user.id, user.timezone, filtersB),
    getTopArtists(user.id, filtersA, 5),
    getTopArtists(user.id, filtersA, 5, "time"),
    getTopArtists(user.id, filtersB, 5),
    getTopArtists(user.id, filtersB, 5, "time"),
    getTopTracks(user.id, filtersA, 5),
    getTopTracks(user.id, filtersA, 5, "time"),
    getTopTracks(user.id, filtersB, 5),
    getTopTracks(user.id, filtersB, 5, "time"),
    getTopGenres(user.id, filtersA, 6),
    getTopGenres(user.id, filtersA, 6, "time"),
    getTopGenres(user.id, filtersB, 6),
    getTopGenres(user.id, filtersB, 6, "time"),
  ]);

  const labelA = formatPeriodLabel(periodA, locale, t("recap.yearLabel"));
  const labelB = formatPeriodLabel(periodB, locale, t("recap.yearLabel"));
  const monthsLong = monthNames(locale);
  const monthsShort = monthShortNames(locale);

  const yearOptions = [
    ...new Set([...years, periodA.year, periodB.year, new Date().getUTCFullYear()]),
  ]
    .filter((year) => year >= 2000)
    .sort((a, b) => b - a);

  const sameShape = periodA.isMonth === periodB.isMonth;
  const points = comparisonSeries(
    periodA,
    extrasA,
    periodB,
    extrasB,
    monthsShort,
  );

  const metrics = [
    {
      label: t("dash.listeningTime"),
      a: formatDuration(overviewA.totalMs, locale),
      b: formatDuration(overviewB.totalMs, locale),
      delta: percentChange(overviewA.totalMs, overviewB.totalMs),
    },
    {
      label: t("dash.metricPlays"),
      a: formatNumber(overviewA.totalPlays, locale),
      b: formatNumber(overviewB.totalPlays, locale),
      delta: percentChange(overviewA.totalPlays, overviewB.totalPlays),
    },
    {
      label: t("dash.artists"),
      a: formatNumber(overviewA.distinctArtists, locale),
      b: formatNumber(overviewB.distinctArtists, locale),
      delta: percentChange(overviewA.distinctArtists, overviewB.distinctArtists),
    },
    {
      label: t("dash.tracks"),
      a: formatNumber(overviewA.distinctTracks, locale),
      b: formatNumber(overviewB.distinctTracks, locale),
      delta: percentChange(overviewA.distinctTracks, overviewB.distinctTracks),
    },
    {
      label: t("dash.albums"),
      a: formatNumber(overviewA.distinctAlbums, locale),
      b: formatNumber(overviewB.distinctAlbums, locale),
      delta: percentChange(overviewA.distinctAlbums, overviewB.distinctAlbums),
    },
  ];

  const swapParams = new URLSearchParams();
  swapParams.set("ay", String(periodB.year));
  if (periodB.month) swapParams.set("am", String(periodB.month));
  swapParams.set("by", String(periodA.year));
  if (periodA.month) swapParams.set("bm", String(periodA.month));

  const isEmpty = overviewA.totalPlays === 0 && overviewB.totalPlays === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("compare.title")}
        </h1>
        <div className="flex flex-wrap items-end gap-2">
          <form action="/compare" className="flex flex-wrap items-end gap-3">
            <PeriodSelect
              title={t("compare.periodA")}
              yearName="ay"
              monthName="am"
              period={periodA}
              yearOptions={yearOptions}
              monthsLong={monthsLong}
              wholeYearLabel={t("recap.wholeYear")}
            />
            <PeriodSelect
              title={t("compare.periodB")}
              yearName="by"
              monthName="bm"
              period={periodB}
              yearOptions={yearOptions}
              monthsLong={monthsLong}
              wholeYearLabel={t("recap.wholeYear")}
            />
            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
            >
              {t("compare.compare")}
            </button>
          </form>
          <Link
            href={`/compare?${swapParams.toString()}`}
            prefetch={false}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent/40 hover:text-accent"
          >
            {t("compare.swap")}
          </Link>
        </div>
      </div>

      {isEmpty ? (
        <EmptyState>{t("compare.noData")}</EmptyState>
      ) : (
        <>
          <Card>
            <SectionTitle
              title={t("compare.overlay")}
              subtitle={t("dash.listeningTime")}
            />
            {sameShape ? (
              <CompareChart points={points} labelA={labelA} labelB={labelB} />
            ) : (
              <EmptyState>{t("compare.sameShape")}</EmptyState>
            )}
          </Card>

          <Card>
            <SectionTitle title={t("compare.summary")} />
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted">
                    <th className="py-2 pr-2 font-medium sm:pr-4">
                      {t("compare.metric")}
                    </th>
                    <th className="py-2 pr-2 font-medium text-accent sm:pr-4">
                      {labelA}
                    </th>
                    <th className="py-2 pr-2 font-medium text-violet sm:pr-4">
                      {labelB}
                    </th>
                    <th className="py-2 font-medium">{t("compare.delta")}</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((metric) => (
                    <tr key={metric.label} className="border-t border-border">
                      <td className="py-2.5 pr-2 text-muted sm:pr-4">
                        {metric.label}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-2 font-medium text-accent sm:pr-4">
                        {metric.a}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-2 font-medium text-violet sm:pr-4">
                        {metric.b}
                      </td>
                      <td className="whitespace-nowrap py-2.5">
                        <DeltaBadge value={metric.delta} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <section className="space-y-6">
            <h2 className="text-lg font-semibold tracking-tight">
              {t("compare.sideBySide")}
            </h2>

            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                {t("top.topArtists")}
              </h3>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <TopArtistsPanel
                    title={labelA}
                    itemsByPlays={artistsAByPlays}
                    itemsByTime={artistsAByTime}
                    query=""
                    empty={t("compare.noData")}
                  />
                </Card>
                <Card>
                  <TopArtistsPanel
                    title={labelB}
                    itemsByPlays={artistsBByPlays}
                    itemsByTime={artistsBByTime}
                    query=""
                    empty={t("compare.noData")}
                  />
                </Card>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                {t("top.topTracks")}
              </h3>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <TopTracksPanel
                    title={labelA}
                    itemsByPlays={tracksAByPlays}
                    itemsByTime={tracksAByTime}
                    query=""
                    showAlbum
                    empty={t("compare.noData")}
                  />
                </Card>
                <Card>
                  <TopTracksPanel
                    title={labelB}
                    itemsByPlays={tracksBByPlays}
                    itemsByTime={tracksBByTime}
                    query=""
                    showAlbum
                    empty={t("compare.noData")}
                  />
                </Card>
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                {t("dash.genres")}
              </h3>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <TopGenresPanel
                    title={labelA}
                    itemsByPlays={genresAByPlays}
                    itemsByTime={genresAByTime}
                    empty={t("compare.noData")}
                  />
                </Card>
                <Card>
                  <TopGenresPanel
                    title={labelB}
                    itemsByPlays={genresBByPlays}
                    itemsByTime={genresBByTime}
                    empty={t("compare.noData")}
                  />
                </Card>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
