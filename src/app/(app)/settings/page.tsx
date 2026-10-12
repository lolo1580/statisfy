import fs from "node:fs";
import path from "node:path";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { getSetting, SETTING_ALLOW_REGISTRATION } from "@/lib/settings";
import { appName, appUrl, appVersion, spotify, syncMinIntervalMs, syncToken } from "@/lib/env";
import {
  deleteConnection,
  setRegistration,
  updateTimezone,
} from "@/lib/actions/connections";
import { deleteUser, revokeInvitation, setUserAdmin } from "@/lib/actions/users";
import {
  ChangePasswordForm,
  CopyField,
  InviteForm,
  ResetPasswordButton,
} from "@/components/admin-forms";
import { listInvitations, purgeInvitations } from "@/lib/invitations";
import { isInvitationUsable } from "@/lib/invitation-rules";
import { requestOrigin } from "@/lib/sources/spotify-state";
import { ConfirmForm } from "@/components/confirm-form";
import {
  EnrichButton,
  ImportForm,
  SpotifyRequestForm,
  SyncButton,
  YourSpotifyImportForm,
} from "@/components/settings-forms";
import {
  approveSpotifyAccess,
  cancelSpotifyRequest,
  rejectSpotifyAccess,
  revokeSpotifyAccess,
} from "@/lib/actions/spotify-access";
import { getSpotifyAccess } from "@/lib/spotify-access";
import { getWrappedShareToken } from "@/lib/wrapped-share";
import {
  disableWrappedShare,
  enableWrappedShare,
} from "@/lib/actions/sharing";
import {
  Badge,
  Card,
  EmptyState,
  SectionTitle,
  StatCard,
} from "@/components/ui";
import { countWindow, getOverview } from "@/lib/stats";
import {
  formatDateTime,
  formatDuration,
  formatNumber,
  startOfLocalDay,
  startOfLocalWeek,
} from "@/lib/format";
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

export default async function SettingsPage({
  searchParams,
}: PageProps<"/settings">) {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const params = await searchParams;
  const ok = typeof params.ok === "string" ? params.ok : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const noticeKey = ok ? `notice.${ok}` : error ? `notice.${error}` : null;

  const now = new Date();
  const sinceToday = startOfLocalDay(user.timezone, now);
  const sinceWeek = startOfLocalWeek(user.timezone, now);

  const [connections, jobs, registrationStored, today, week, overview, spotifyAccess, wrappedShareToken] =
    await Promise.all([
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
      getSetting(SETTING_ALLOW_REGISTRATION),
      countWindow(user.id, sinceToday, now),
      countWindow(user.id, sinceWeek, now),
      getOverview(user.id, { days: null }),
      getSpotifyAccess(user.id),
      getWrappedShareToken(user.id),
    ]);

  // Données administratives : chargées uniquement pour un administrateur
  // (moindre privilège — jamais pour un compte standard).
  const users = user.isAdmin
    ? await prisma.user.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          isAdmin: true,
          spotifyAccessStatus: true,
          spotifyAccount: true,
          spotifyRequestedAt: true,
          _count: { select: { plays: true, connections: true } },
        },
      })
    : [];
  // Nettoyage des invitations consommées/expirées, puis chargement (admin).
  let invitations: Awaited<ReturnType<typeof listInvitations>> = [];
  if (user.isAdmin) {
    await purgeInvitations();
    invitations = await listInvitations();
  }

  const registrationEnabled =
    registrationStored === null
      ? process.env.ALLOW_REGISTRATION !== "false"
      : registrationStored === "true";

  // Origine publique pour construire des liens d'invitation absolus.
  const inviteOrigin = (await requestOrigin()) ?? appUrl;

  const hasSpotifyConnection = connections.some((c) => c.type === "spotify");
  const canConnectSpotifyUi =
    user.isAdmin ||
    spotifyAccess.status === "approved" ||
    hasSpotifyConnection;
  // Accès Spotify des autres comptes : pending d'abord, puis approuvés/refusés.
  const spotifyAccessRank = (status: string) =>
    status === "pending" ? 0 : status === "approved" ? 1 : 2;
  const spotifyAccessRows = users
    .filter((member) => !member.isAdmin && member.spotifyAccessStatus !== "none")
    .sort(
      (a, b) =>
        spotifyAccessRank(a.spotifyAccessStatus) -
        spotifyAccessRank(b.spotifyAccessStatus),
    );
  const pendingSpotifyCount = spotifyAccessRows.filter(
    (member) => member.spotifyAccessStatus === "pending",
  ).length;
  const spotifyBadge = user.isAdmin ? null : spotifyAccess.status === "pending" ? (
    <Badge tone="violet">{t("settings.spotifyPendingBadge")}</Badge>
  ) : spotifyAccess.status === "rejected" ? (
    <Badge tone="danger">{t("settings.spotifyRejectedBadge")}</Badge>
  ) : spotifyAccess.status === "approved" ? (
    <Badge tone="accent">{t("settings.spotifyApproved")}</Badge>
  ) : null;

  const timezones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [user.timezone];

  const sourceLabel = (value: string) =>
    value === "spotify"
      ? t("source.spotify")
      : value === "import"
        ? t("source.import")
        : value;
  const jobType = (value: string) =>
    value === "import" ? t("status.import") : t("status.sync");

  // I/O disque réservées à l'administrateur (moindre privilège) et faites en
  // asynchrone pour ne pas bloquer la boucle d'événements.
  let dbBytes: number | null = null;
  let backupCount = 0;
  let backupLatest: string | null = null;
  if (user.isAdmin) {
    try {
      const rows = await prisma.$queryRaw<
        Array<{ size: bigint | number | null }>
      >`SELECT pg_database_size(current_database()) AS size`;
      const value = rows[0]?.size;
      dbBytes = value === null || value === undefined ? null : Number(value);
    } catch {
      dbBytes = null;
    }

    const backupDir =
      process.env.BACKUP_DIR || path.join(process.cwd(), "backups");
    try {
      const files = (await fs.promises.readdir(/*turbopackIgnore: true*/ backupDir))
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
  }

  const lastSync = connections
    .map((c) => c.lastSyncedAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

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
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("settings.title")}
      </h1>

      {noticeKey ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            ok
              ? "border-accent/30 bg-accent-soft text-accent"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          {t(noticeKey)}
        </div>
      ) : null}

      <div className="columns-1 gap-6 lg:columns-2 3xl:columns-3 [&>*]:mb-6 [&>*]:break-inside-avoid">
      <Card>
        <SectionTitle
          title={t("settings.account")}
          subtitle={`${user.name} · ${user.email}`}
        />
        <form action={updateTimezone} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label htmlFor="timezone" className="mb-1 block text-sm text-muted">
              {t("settings.timezone")}
            </label>
            <select
              id="timezone"
              name="timezone"
              defaultValue={user.timezone}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:border-accent/40 hover:text-accent"
          >
            {t("settings.save")}
          </button>
        </form>
        <div className="mt-4 border-t border-border pt-4">
          <h3 className="text-sm font-medium">{t("settings.changePassword")}</h3>
          <ChangePasswordForm />
        </div>
      </Card>

      <Card>
        <SectionTitle
          title={t("settings.connectSpotify")}
          subtitle={t("settings.connectSpotifySubtitle")}
          action={spotifyBadge}
        />
        {!spotify.configured ? (
          <div className="space-y-2 text-sm text-muted">
            <p>
              {t("settings.spotifyNotConfigured")}{" "}
              <a
                href="https://developer.spotify.com/dashboard"
                className="text-accent hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Spotify
              </a>
            </p>
            <p className="text-xs">
              {t("settings.redirectUri")}{" "}
              <code>
                {process.env.SPOTIFY_REDIRECT_URI ??
                  "http://127.0.0.1:3000/oauth/spotify/callback"}
              </code>
            </p>
          </div>
        ) : canConnectSpotifyUi ? (
          <a
            href="/api/sources/spotify/start"
            className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#04140d] transition-opacity hover:opacity-90"
          >
            {t("settings.connectSpotifyCta")}
          </a>
        ) : spotifyAccess.status === "pending" ? (
          <div className="space-y-3">
            <p className="text-sm text-accent">
              {t("settings.spotifyPending", {
                date: formatDateTime(
                  spotifyAccess.requestedAt ?? now,
                  user.timezone,
                  locale,
                ),
              })}
            </p>
            {spotifyAccess.account ? (
              <p className="text-sm text-muted">
                {t("settings.spotifyAccountLabel", {
                  account: spotifyAccess.account,
                })}
              </p>
            ) : null}
            <SpotifyRequestForm defaultAccount={spotifyAccess.account ?? ""} />
            <form action={cancelSpotifyRequest}>
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
              >
                {t("settings.spotifyCancel")}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-3">
            {spotifyAccess.status === "rejected" ? (
              <p className="text-sm text-red-400">
                {t("settings.spotifyRejected")}
              </p>
            ) : null}
            <p className="text-sm text-muted">
              {t("settings.spotifyAccessNeeded")}
            </p>
            <SpotifyRequestForm defaultAccount={spotifyAccess.account ?? ""} />
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle
          title={t("settings.import")}
          subtitle={t("settings.importSubtitle")}
        />
        <ImportForm />
      </Card>

      <Card>
        <SectionTitle
          title={t("settings.yourspotify")}
          subtitle={t("settings.yourspotifySubtitle")}
        />
        <YourSpotifyImportForm />
      </Card>

      {spotify.configured ? (
        <Card>
          <SectionTitle
            title={t("settings.visuals")}
            subtitle={t("settings.visualsSubtitle")}
          />
          <EnrichButton />
        </Card>
      ) : null}

      <Card>
        <SectionTitle title={t("settings.sources")} />
        {connections.length === 0 ? (
          <EmptyState>{t("settings.noSources")}</EmptyState>
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
                    {connection.status === "error" ? (
                      <Badge tone="danger">{connection.status}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {t("settings.lastSync", {
                      date: connection.lastSyncedAt
                        ? formatDateTime(
                            connection.lastSyncedAt,
                            user.timezone,
                            locale,
                          )
                        : t("status.never"),
                    })}
                  </p>
                  {connection.lastError ? (
                    <p className="mt-0.5 text-xs text-red-400">
                      {connection.lastError}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <SyncButton connectionId={connection.id} />
                  <form action={deleteConnection}>
                    <input
                      type="hidden"
                      name="connectionId"
                      value={connection.id}
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
                    >
                      {t("settings.delete")}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle title={t("settings.activity")} />
        {jobs.length === 0 ? (
          <EmptyState>{t("settings.noActivity")}</EmptyState>
        ) : (
          <div className="max-h-72 overflow-y-auto pr-1">
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

      <Card>
        <SectionTitle
          title={t("settings.export")}
          subtitle={t("settings.exportHint")}
        />
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/export"
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:border-accent/40 hover:text-accent"
          >
            {t("settings.exportCsv")}
          </a>
          {user.isAdmin ? (
            <a
              href="/api/export/db"
              className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:border-accent/40 hover:text-accent"
            >
              {t("settings.exportDb")}
            </a>
          ) : null}
        </div>
      </Card>

      <Card>
        <SectionTitle
          title={t("settings.share")}
          subtitle={t("settings.shareSubtitle")}
        />
        {wrappedShareToken ? (
          <div className="space-y-3">
            <CopyField
              value={`${inviteOrigin}/share/wrapped/${wrappedShareToken}`}
              label={t("settings.shareLink")}
            />
            <div className="flex flex-wrap gap-2">
              <form action={enableWrappedShare}>
                <button
                  type="submit"
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent"
                >
                  {t("settings.shareRegenerate")}
                </button>
              </form>
              <ConfirmForm
                action={disableWrappedShare}
                fields={{}}
                message={t("settings.confirmUnshare")}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
              >
                {t("settings.shareDisable")}
              </ConfirmForm>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">{t("settings.shareHint")}</p>
            <form action={enableWrappedShare}>
              <button
                type="submit"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#04140d] transition-opacity hover:opacity-90"
              >
                {t("settings.shareEnable")}
              </button>
            </form>
          </div>
        )}
      </Card>

      {user.isAdmin ? (
        <Card>
          <SectionTitle
            title={t("settings.admin")}
            subtitle={t("settings.instance", { name: appName })}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {t("settings.registration", {
                state: registrationEnabled
                  ? t("settings.allowed")
                  : t("settings.disabled"),
              })}
            </p>
            <form action={setRegistration}>
              <input
                type="hidden"
                name="enabled"
                value={registrationEnabled ? "false" : "true"}
              />
              <button
                type="submit"
                className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:border-accent/40 hover:text-accent"
              >
                {registrationEnabled
                  ? t("settings.disableReg")
                  : t("settings.enableReg")}
              </button>
            </form>
          </div>
        </Card>
      ) : null}

      {user.isAdmin ? (
        <Card>
          <SectionTitle
            title={t("settings.spotifyRequests")}
            subtitle={t("settings.spotifyRequestsSubtitle")}
            action={
              pendingSpotifyCount > 0 ? (
                <Badge tone="violet">{pendingSpotifyCount}</Badge>
              ) : undefined
            }
          />
          {spotifyAccessRows.length === 0 ? (
            <EmptyState>{t("settings.spotifyNoRequests")}</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {spotifyAccessRows.map((request) => {
                const pending = request.spotifyAccessStatus === "pending";
                const approved = request.spotifyAccessStatus === "approved";
                return (
                  <li
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {request.name}
                        </span>
                        {request.spotifyAccount ? (
                          <Badge tone="violet">{request.spotifyAccount}</Badge>
                        ) : null}
                        <Badge
                          tone={
                            pending ? "violet" : approved ? "accent" : "danger"
                          }
                        >
                          {pending
                            ? t("settings.spotifyPendingBadge")
                            : approved
                              ? t("settings.spotifyApproved")
                              : t("settings.spotifyRejectedBadge")}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {request.email}
                        {request.spotifyRequestedAt
                          ? ` · ${t("settings.spotifyRequestedAt", {
                              date: formatDateTime(
                                request.spotifyRequestedAt,
                                user.timezone,
                                locale,
                              ),
                            })}`
                          : null}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {pending ? (
                        <>
                          <form action={approveSpotifyAccess}>
                            <input
                              type="hidden"
                              name="userId"
                              value={request.id}
                            />
                            <button
                              type="submit"
                              className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent transition-opacity hover:opacity-90"
                            >
                              {t("settings.spotifyApprove")}
                            </button>
                          </form>
                          <form action={rejectSpotifyAccess}>
                            <input
                              type="hidden"
                              name="userId"
                              value={request.id}
                            />
                            <button
                              type="submit"
                              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
                            >
                              {t("settings.spotifyReject")}
                            </button>
                          </form>
                        </>
                      ) : approved ? (
                        <ConfirmForm
                          action={revokeSpotifyAccess}
                          fields={{ userId: request.id }}
                          message={t("settings.confirmRevoke", {
                            name: request.name,
                          })}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
                        >
                          {t("settings.spotifyRevoke")}
                        </ConfirmForm>
                      ) : (
                        <form action={approveSpotifyAccess}>
                          <input
                            type="hidden"
                            name="userId"
                            value={request.id}
                          />
                          <button
                            type="submit"
                            className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent transition-opacity hover:opacity-90"
                          >
                            {t("settings.spotifyApprove")}
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}

      {user.isAdmin ? (
        <Card>
          <SectionTitle
            title={t("settings.users")}
            subtitle={t("settings.usersSubtitle")}
          />
          <ul className="divide-y divide-border">
            {users.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{member.name}</span>
                    {member.isAdmin ? (
                      <Badge tone="accent">{t("settings.userAdmin")}</Badge>
                    ) : null}
                    {member.id === user.id ? (
                      <Badge>{t("settings.you")}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {member.email} ·{" "}
                    {t("settings.userStats", {
                      plays: formatNumber(member._count.plays, locale),
                      sources: member._count.connections,
                    })}
                  </p>
                </div>
                {member.id !== user.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={setUserAdmin}>
                      <input type="hidden" name="userId" value={member.id} />
                      <input
                        type="hidden"
                        name="isAdmin"
                        value={member.isAdmin ? "false" : "true"}
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent"
                      >
                        {member.isAdmin
                          ? t("settings.removeAdmin")
                          : t("settings.makeAdmin")}
                      </button>
                    </form>
                    <ResetPasswordButton userId={member.id} />
                    <ConfirmForm
                      action={deleteUser}
                      fields={{ userId: member.id }}
                      message={t("settings.confirmDeleteUser", {
                        name: member.name,
                      })}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
                    >
                      {t("settings.deleteUser")}
                    </ConfirmForm>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {user.isAdmin ? (
        <Card>
          <SectionTitle
            title={t("settings.invitations")}
            subtitle={t("settings.invitationsSubtitle")}
          />
          <InviteForm origin={inviteOrigin} />
          <div className="mt-4">
            {invitations.length === 0 ? (
              <EmptyState>{t("settings.inviteNone")}</EmptyState>
            ) : (
              <ul className="divide-y divide-border">
                {invitations.map((invitation) => {
                  const usable = isInvitationUsable(invitation);
                  const status = invitation.usedAt
                    ? { tone: "neutral" as const, label: t("settings.inviteUsed") }
                    : usable
                      ? { tone: "accent" as const, label: t("settings.invitePending") }
                      : { tone: "danger" as const, label: t("settings.inviteExpired") };
                  return (
                    <li key={invitation.id} className="space-y-2 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {invitation.email ?? t("settings.anyEmail")}
                          </span>
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </div>
                        <form action={revokeInvitation}>
                          <input
                            type="hidden"
                            name="invitationId"
                            value={invitation.id}
                          />
                          <button
                            type="submit"
                            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
                          >
                            {t("settings.revoke")}
                          </button>
                        </form>
                      </div>
                      <p className="text-xs text-muted">
                        {t("settings.inviteExpires", {
                          date: formatDateTime(
                            invitation.expiresAt,
                            user.timezone,
                            locale,
                          ),
                        })}
                      </p>
                      {usable ? (
                        <CopyField
                          value={`${inviteOrigin}/register?invite=${invitation.token}`}
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      ) : null}
      </div>

      <div className="space-y-4">
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
        {user.isAdmin ? (
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
        ) : null}
      </div>
    </div>
  );
}
