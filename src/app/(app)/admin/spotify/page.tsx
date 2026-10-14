import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import {
  approveSpotifyAccess,
  rejectSpotifyAccess,
  revokeSpotifyAccess,
} from "@/lib/actions/spotify-access";
import { ConfirmForm } from "@/components/confirm-form";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/** Validation des demandes d'accès à l'API Spotify. */
export default async function AdminSpotifyPage() {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      spotifyAccessStatus: true,
      spotifyAccount: true,
      spotifyRequestedAt: true,
    },
  });

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

  return (
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
                    <span className="text-sm font-medium">{request.name}</span>
                    {request.spotifyAccount ? (
                      <Badge tone="violet">{request.spotifyAccount}</Badge>
                    ) : null}
                    <Badge
                      tone={pending ? "violet" : approved ? "accent" : "danger"}
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
                      <input type="hidden" name="userId" value={request.id} />
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
  );
}
