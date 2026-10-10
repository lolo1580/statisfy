import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { getSetting, SETTING_ALLOW_REGISTRATION } from "@/lib/settings";
import { appName, spotify } from "@/lib/env";
import {
  deleteConnection,
  setRegistration,
  updateTimezone,
} from "@/lib/actions/connections";
import {
  EnrichButton,
  ImportForm,
  SyncButton,
  YourSpotifyImportForm,
} from "@/components/settings-forms";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { formatDateTime, formatNumber } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: PageProps<"/settings">) {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const params = await searchParams;
  const ok = typeof params.ok === "string" ? params.ok : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const noticeKey = ok ? `notice.${ok}` : error ? `notice.${error}` : null;

  const [connections, jobs, registrationStored] = await Promise.all([
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
  ]);

  const registrationEnabled =
    registrationStored === null
      ? process.env.ALLOW_REGISTRATION !== "false"
      : registrationStored === "true";

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

      <div className="grid gap-6 3xl:grid-cols-2 3xl:items-start">
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
      </Card>

      <Card>
        <SectionTitle
          title={t("settings.connectSpotify")}
          subtitle={t("settings.connectSpotifySubtitle")}
        />
        {spotify.configured ? (
          <a
            href="/api/sources/spotify/start"
            className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#04140d] transition-opacity hover:opacity-90"
          >
            {t("settings.connectSpotifyCta")}
          </a>
        ) : (
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
                  "http://localhost:3000/oauth/spotify/callback"}
              </code>
            </p>
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
      </div>
    </div>
  );
}
