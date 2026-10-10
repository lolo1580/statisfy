import fs from "node:fs";
import path from "node:path";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { countWindow, getOverview } from "@/lib/stats";
import { startOfLocalDay, startOfLocalWeek } from "@/lib/format";
import { appName, syncMinIntervalMs, syncToken } from "@/lib/env";
import { Badge, Card, EmptyState, SectionTitle, StatCard } from "@/components/ui";
import { formatDateTime, formatDuration, formatNumber } from "@/lib/format";
import { getI18n } from "@/i18n/server";
import type { Translator } from "@/i18n";

export const dynamic = "force-dynamic";

function humanBytes(bytes: number, t: Translator): string {
  if (bytes < 1024) return `${bytes} ${t("bytes.b")}`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ${t("bytes.kb")}`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ${t("bytes.mb")}`;
}

function humanUptime(seconds: number, t: Translator): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return t("uptime.days", { d, h });
  if (h > 0) return t("uptime.hours", { h, m });
  return t("uptime.minutes", { m });
}

export default async function StatusPage() {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const now = new Date();
  const sinceToday = startOfLocalDay(user.timezone, now);
  const sinceWeek = startOfLocalWeek(user.timezone, now);

  const [today, week, total, connections, jobs] = await Promise.all([
    countWindow(user.id, sinceToday, now),
    countWindow(user.id, sinceWeek, now),
    getOverview(user.id, { days: null }),
    prisma.sourceConnection.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.job.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { connection: true },
    }),
  ]);

  const dbUrl = process.env.DATABASE_URL ?? "";
  const dbPath = dbUrl.startsWith("file:") ? dbUrl.slice("file:".length) : "";
  let dbBytes: number | null = null;
  try {
    if (dbPath) dbBytes = fs.statSync(/*turbopackIgnore: true*/ dbPath).size;
  } catch {
    dbBytes = null;
  }

  const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");
  let backupCount = 0;
  let backupLatest: string | null = null;
  try {
    const files = fs
      .readdirSync(/*turbopackIgnore: true*/ backupDir)
      .filter((name) => name.startsWith("statisfy-") && name.endsWith(".db"))
      .sort();
    backupCount = files.length;
    if (files.length > 0) {
      const stat = fs.statSync(
        /*turbopackIgnore: true*/ path.join(
          /*turbopackIgnore: true*/ backupDir,
          files[files.length - 1],
        ),
      );
      backupLatest = new Intl.DateTimeFormat(locale, {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: user.timezone,
      }).format(stat.mtime);
    }
  } catch {
    backupCount = 0;
  }

  const lastSync = connections
    .map((c) => c.lastSyncedAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const nextSync = lastSync
    ? new Date(lastSync.getTime() + syncMinIntervalMs)
    : null;

  const sourceLabel = (value: string) =>
    value === "spotify"
      ? t("source.spotify")
      : value === "import"
        ? t("source.import")
        : value;
  const jobType = (value: string) =>
    value === "import" ? t("status.import") : t("status.sync");

  const systemRows: Array<[string, string]> = [
    [t("status.app"), appName],
    [t("status.env"), process.env.NODE_ENV ?? "—"],
    [t("status.node"), process.version],
    [t("status.uptime"), humanUptime(process.uptime(), t)],
    [t("status.dbSize"), dbBytes !== null ? humanBytes(dbBytes, t) : "—"],
    [
      t("status.backups"),
      backupCount > 0
        ? `${t("status.backupsValue", { count: backupCount })}${
            backupLatest ? ` · ${backupLatest}` : ""
          }`
        : "—",
    ],
    [
      t("status.autoSync"),
      syncToken
        ? t("status.autoSyncOn", { minutes: Math.round(syncMinIntervalMs / 60000) })
        : t("status.autoSyncOff"),
    ],
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("status.title")}
      </h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t("status.today")}
          value={formatNumber(today.plays, locale)}
          hint={formatDuration(today.msPlayed)}
        />
        <StatCard
          label={t("status.week")}
          value={formatNumber(week.plays, locale)}
          hint={formatDuration(week.msPlayed)}
        />
        <StatCard
          label={t("status.total")}
          value={formatNumber(total.totalPlays, locale)}
          hint={formatDuration(total.totalMs)}
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

      <Card>
        <SectionTitle
          title={t("status.connections")}
          subtitle={t("status.connectionsSubtitle")}
        />
        {connections.length === 0 ? (
          <EmptyState>{t("status.noSources")}</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {connections.map((connection) => (
              <li
                key={connection.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {connection.displayName}
                    </span>
                    <Badge tone="violet">{sourceLabel(connection.type)}</Badge>
                    <Badge
                      tone={connection.status === "error" ? "danger" : "accent"}
                    >
                      {connection.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {t("settings.lastSync", {
                      date: connection.lastSyncedAt
                        ? formatDateTime(connection.lastSyncedAt, user.timezone, locale)
                        : t("status.never"),
                    })}
                  </p>
                  {connection.lastError ? (
                    <p className="mt-0.5 text-xs text-red-400">
                      {connection.lastError}
                    </p>
                  ) : null}
                </div>
                {nextSync ? (
                  <span className="text-xs text-muted">
                    {t("status.nextSync", {
                      time: new Intl.DateTimeFormat(locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: user.timezone,
                      }).format(nextSync),
                      minutes: Math.round(syncMinIntervalMs / 60000),
                    })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle title={t("status.system")} />
          <dl className="space-y-2 text-sm">
            {systemRows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <SectionTitle title={t("status.activity")} />
          {jobs.length === 0 ? (
            <EmptyState>{t("status.noActivity")}</EmptyState>
          ) : (
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
                  <span className="hidden w-32 text-right text-xs text-muted md:inline">
                    {formatDateTime(job.createdAt, user.timezone, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
