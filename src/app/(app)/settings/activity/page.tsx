import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { Badge, Card, EmptyState, SectionTitle, StatCard } from "@/components/ui";
import { countWindow, getOverview } from "@/lib/stats";
import {
  formatDateTime,
  formatDuration,
  formatNumber,
  startOfLocalDay,
  startOfLocalWeek,
} from "@/lib/format";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/** Activité récente et statistiques personnelles. */
export default async function SettingsActivityPage() {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const now = new Date();
  const sinceToday = startOfLocalDay(user.timezone, now);
  const sinceWeek = startOfLocalWeek(user.timezone, now);

  const [connections, jobs, today, week, overview] = await Promise.all([
    prisma.sourceConnection.findMany({
      where: { userId: user.id },
      select: { lastSyncedAt: true },
    }),
    prisma.job.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { connection: true },
    }),
    countWindow(user.id, sinceToday, now),
    countWindow(user.id, sinceWeek, now),
    getOverview(user.id, { days: null }),
  ]);

  const jobType = (value: string) =>
    value === "import" ? t("status.import") : t("status.sync");

  // Part des écoutes comptabilisées (ayant atteint le seuil d'écoute).
  const completionPct =
    overview.allPlays > 0
      ? Math.round((overview.totalPlays / overview.allPlays) * 100)
      : null;

  const lastSync = connections
    .map((c) => c.lastSyncedAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          {t("status.title")}
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label={t("status.today")}
            value={formatNumber(today.plays, locale)}
            hint={formatDuration(today.msPlayed, locale)}
          />
          <StatCard
            label={t("status.week")}
            value={formatNumber(week.plays, locale)}
            hint={formatDuration(week.msPlayed, locale)}
          />
          <StatCard
            label={t("status.total")}
            value={formatNumber(overview.totalPlays, locale)}
            hint={formatDuration(overview.totalMs, locale)}
          />
          <StatCard
            label={t("status.lastSync")}
            value={
              lastSync
                ? new Intl.DateTimeFormat(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: user.timezone,
                  }).format(lastSync)
                : "—"
            }
            hint={
              lastSync
                ? new Intl.DateTimeFormat(locale, {
                    dateStyle: "short",
                    timeZone: user.timezone,
                  }).format(lastSync)
                : undefined
            }
          />
        </div>
        {completionPct !== null ? (
          <p className="text-xs text-muted">
            {t("settings.completionRate", {
              percent: formatNumber(completionPct, locale),
            })}
          </p>
        ) : null}
      </section>

      <Card>
        <SectionTitle title={t("settings.activity")} />
        {jobs.length === 0 ? (
          <EmptyState>{t("settings.noActivity")}</EmptyState>
        ) : (
          <div className="max-h-96 overflow-y-auto pr-1">
            <ul className="divide-y divide-border text-sm">
              {jobs.map((job) => (
                <li key={job.id} className="flex items-center gap-3 py-2.5">
                  <Badge tone={job.type === "import" ? "neutral" : "violet"}>
                    {jobType(job.type)}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {job.connection?.displayName ?? t("status.importedHistory")}
                  </span>
                  <span className="text-xs text-muted">
                    +{formatNumber(job.inserted, locale)}
                  </span>
                  <Badge
                    tone={
                      job.status === "done"
                        ? "accent"
                        : job.status === "error"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {job.status}
                  </Badge>
                  <span className="hidden w-40 text-right text-xs text-muted md:inline">
                    {formatDateTime(job.createdAt, user.timezone, locale)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
