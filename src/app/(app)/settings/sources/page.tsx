import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { spotify } from "@/lib/env";
import { cancelSpotifyRequest } from "@/lib/actions/spotify-access";
import { getSpotifyAccess } from "@/lib/spotify-access";
import { EnrichButton, SpotifyRequestForm } from "@/components/settings-forms";
import { ConnectionsList } from "@/components/connections-list";
import { Badge, Card, SectionTitle } from "@/components/ui";
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
    user.isAdmin || spotifyAccess.status === "approved" || hasSpotifyConnection;
  const spotifyBadge =
    spotifyAccess.status === "pending" ? (
      <Badge tone="violet">{t("settings.spotifyPendingBadge")}</Badge>
    ) : spotifyAccess.status === "rejected" ? (
      <Badge tone="danger">{t("settings.spotifyRejectedBadge")}</Badge>
    ) : spotifyAccess.status === "approved" ? (
      <Badge tone="accent">{t("settings.spotifyApproved")}</Badge>
    ) : null;

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
            className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
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
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-danger/40 hover:text-danger"
              >
                {t("settings.spotifyCancel")}
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-3">
            {spotifyAccess.status === "rejected" ? (
              <p className="text-sm text-danger">
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
        <ConnectionsList connections={connections} timezone={user.timezone} />
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
