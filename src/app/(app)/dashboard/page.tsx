import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import {
  getArtistTrends,
  getOverview,
  getTimelineStats,
  getTopArtists,
  getTopGenres,
  getTopTracks,
  hasAnyPlays,
  type StatsRange,
} from "@/lib/stats";
import { RangeTabs } from "@/components/range-tabs";
import { parseRange } from "@/lib/range";
import { AreaChart } from "@/components/charts";
import { Badge, Card, Cover, EmptyState, SectionTitle, StatCard } from "@/components/ui";
import { TopArtistsPanel, TopGenresPanel, TopTracksPanel } from "@/components/ranking-panels";
import { formatDuration, formatNumber } from "@/lib/format";
import { getI18n } from "@/i18n/server";
import { prisma } from "@/lib/db";
import { dismissChecklist } from "@/lib/actions/onboarding";
import { WelcomeModal } from "@/components/welcome-modal";

export const dynamic = "force-dynamic";

const dayLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

/** Ligne de la checklist « Bien démarrer ». */
function ChecklistItem({
  done,
  href,
  label,
}: {
  done: boolean;
  href: string;
  label: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm transition-colors hover:border-accent/40"
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
            done
              ? "border-accent bg-accent-soft text-accent"
              : "border-border text-transparent"
          }`}
          aria-hidden
        >
          ✓
        </span>
        <span className={done ? "text-muted line-through" : ""}>{label}</span>
        {!done ? (
          <span className="ml-auto text-muted" aria-hidden>
            →
          </span>
        ) : null}
      </Link>
    </li>
  );
}

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
  const filters: StatsRange = {
    days: parsed.days,
    from: parsed.from,
    to: parsed.to,
  };
  const query = `range=${parsed.key}`;

  const [
    overview,
    timeline,
    topTracks,
    topArtists,
    topGenres,
    trends,
    anyPlays,
    spotifyConnection,
    importedPlay,
    onboarding,
  ] = await Promise.all([
    getOverview(user.id, filters),
    getTimelineStats(user.id, user.timezone, filters),
    getTopTracks(user.id, filters, 10),
    getTopArtists(user.id, filters, 10),
    getTopGenres(user.id, filters, 10),
    getArtistTrends(user.id, filters, 4),
    hasAnyPlays(user.id),
    prisma.sourceConnection.findFirst({
      where: { userId: user.id, type: "spotify" },
      select: { id: true },
    }),
    prisma.play.findFirst({
      where: { userId: user.id, source: "import" },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { onboardedAt: true, checklistHiddenAt: true },
    }),
  ]);

  // Didacticiel : accueil une seule fois + checklist tant que rien n'est démarré.
  const hasSpotify = spotifyConnection !== null;
  const hasImport = importedPlay !== null;
  const showChecklist =
    !onboarding?.checklistHiddenAt && !(hasSpotify && hasImport);
  const showWelcome = !onboarding?.onboardedAt;

  const isEmpty = overview.totalPlays === 0;
  // Période d'un seul jour (« aujourd'hui ») : le graphe « Écoute dans le temps »
  // devient horaire pour rester pertinent.
  const isSingleDay = parsed.days === 1;
  const overTimePoints = isSingleDay
    ? timeline.hourly.hours.map((h) => ({
        label: `${String(h.hour).padStart(2, "0")}h`,
        value: h.msPlayed,
        title: `${String(h.hour).padStart(2, "0")}:00`,
      }))
    : timeline.daily.map((d) => ({
        label: dayLabel(d.day),
        value: d.msPlayed,
        title: dayTitle(d.day),
      }));

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
          <RangeTabs basePath="/dashboard" current={parsed.key} />
        </div>
      </div>

      <WelcomeModal initialOpen={showWelcome} />

      {showChecklist ? (
        <Card>
          <SectionTitle
            title={t("checklist.title")}
            subtitle={t("checklist.subtitle")}
            action={
              <form action={dismissChecklist}>
                <button
                  type="submit"
                  className="text-xs text-muted transition-colors hover:text-foreground"
                >
                  {t("checklist.hide")}
                </button>
              </form>
            }
          />
          <ul className="space-y-2">
            <ChecklistItem
              done={hasSpotify}
              href="/settings"
              label={t("checklist.connect")}
            />
            <ChecklistItem
              done={hasImport}
              href="/settings"
              label={t("checklist.import")}
            />
            <ChecklistItem
              done={false}
              href="/top"
              label={t("checklist.explore")}
            />
          </ul>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      {isEmpty ? (
        anyPlays ? (
          <EmptyState>{t("generic.noData")}</EmptyState>
        ) : (
          <EmptyState>
            {t("dash.empty")}{" "}
            <Link href="/settings" className="text-accent hover:underline">
              {t("nav.settings")}
            </Link>
          </EmptyState>
        )
      ) : (
        <>
          <Card>
            <SectionTitle
              title={t("dash.overTime")}
              subtitle={isSingleDay ? t("dash.hourlyTime") : t("dash.dailyTime")}
            />
            <AreaChart points={overTimePoints} />
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

          {trends.hasPrevious &&
          (trends.rising.length > 0 || trends.falling.length > 0) ? (
            <Card>
              <SectionTitle
                title={t("dash.trends")}
                subtitle={t("dash.trendsSubtitle", { days: parsed.days ?? "" })}
                action={
                  <Link
                    href="/trends"
                    className="text-sm text-accent hover:underline"
                  >
                    {t("trends.link")}
                  </Link>
                }
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
