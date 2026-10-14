import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { spotify } from "@/lib/env";
import { deleteConnection } from "@/lib/actions/connections";
import { cancelSpotifyRequest } from "@/lib/actions/spotify-access";
import { getSpotifyAccess } from "@/lib/spotify-access";
import {
  EnrichButton,
  SpotifyRequestForm,
  SyncButton,
} from "@/components/settings-forms";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/** Connexion Spotify, sources connectées et visuels. */
export default async function SettingsSourcesPage() {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const now = new Date();

  const [connections, spotifyAccess] = await Promise.all([
    prisma.sourceConnection.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    }),
    getSpotifyAccess(user.id),
  ]);

  const hasSpotifyConnection = connections.some((c) => c.type === "spotify");
  const canConnectSpotifyUi =
    user.isAdmin ||
    spotifyAccess.status === "approved" ||
    hasSpotifyConnection;
  const spotifyBadge =
    spotifyAccess.status === "pending" ? (
      <Badge tone="violet">{t("settings.spotifyPendingBadge")}</Badge>
    ) : spotifyAccess.status === "rejected" ? (
      <Badge tone="danger">{t("settings.spotifyRejectedBadge")}</Badge>
    ) : spotifyAccess.status === "approved" ? (
      <Badge tone="accent">{t("settings.spotifyApproved")}</Badge>
    ) : null;

  const sourceLabel = (value: string) =>
    value === "spotify"
      ? t("source.spotify")
      : value === "import"
        ? t("source.import")
        : value;

  return (
    <div className="space-y-6">
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

      {spotify.configured ? (
        <Card>
          <SectionTitle
            title={t("settings.visuals")}
            subtitle={t("settings.visualsSubtitle")}
          />
          <EnrichButton />
        </Card>
      ) : null}
    </div>
  );
}
