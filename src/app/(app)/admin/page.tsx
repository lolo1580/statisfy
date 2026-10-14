import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import {
  appName,
  appVersion,
  syncMinIntervalMs,
  syncToken,
} from "@/lib/env";
import { Card, SectionTitle, StatCard } from "@/components/ui";
import { getI18n } from "@/i18n/server";
import { formatNumber } from "@/lib/format";
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

/** Vue d'ensemble de l'instance : compteurs, état système, sauvegardes. */
export default async function AdminOverviewPage() {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const now = new Date();

  const [users, admins, pending, invitations] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isAdmin: true } }),
    prisma.user.count({ where: { spotifyAccessStatus: "pending" } }),
    prisma.invitation.count({
      where: { usedAt: null, expiresAt: { gt: now } },
    }),
  ]);

  let dbBytes: number | null = null;
  try {
    const rows = await prisma.$queryRaw<
      Array<{ size: bigint | number | null }>
    >`SELECT pg_database_size(current_database()) AS size`;
    const value = rows[0]?.size;
    dbBytes = value === null || value === undefined ? null : Number(value);
  } catch {
    dbBytes = null;
  }

  let backupCount = 0;
  let backupLatest: string | null = null;
  const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");
  try {
    const files = (
      await fs.promises.readdir(/*turbopackIgnore: true*/ backupDir)
    )
      .filter((name) => name.startsWith("statisfy-") && name.endsWith(".dump"))
      .sort();
    backupCount = files.length;
    if (files.length > 0) {
      const stat = await fs.promises.stat(
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

  const systemRows: Array<[string, string]> = [
    [t("status.app"), appName],
    [t("status.version"), appVersion],
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
        ? t("status.autoSyncOn", {
            minutes: Math.round(syncMinIntervalMs / 60000),
          })
        : t("status.autoSyncOff"),
    ],
  ];

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle
          title={t("admin.overviewTitle")}
          subtitle={t("admin.overviewSubtitle")}
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label={t("admin.statUsers")}
            value={formatNumber(users, locale)}
            hint={t("admin.statAdminsHint", { count: admins })}
          />
          <StatCard
            label={t("admin.statAdmins")}
            value={formatNumber(admins, locale)}
          />
          <StatCard
            label={t("admin.statPending")}
            value={formatNumber(pending, locale)}
          />
          <StatCard
            label={t("admin.statInvitations")}
            value={formatNumber(invitations, locale)}
          />
        </div>
      </section>

      <Card>
        <SectionTitle
          title={t("status.system")}
          subtitle={t("admin.systemSubtitle")}
        />
        <dl className="space-y-2 text-sm">
          {systemRows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-muted">{label}</dt>
              <dd className="text-right">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
