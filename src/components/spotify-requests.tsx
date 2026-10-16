"use client";

import {
  approveSpotifyAccess,
  rejectSpotifyAccess,
  revokeSpotifyAccess,
} from "@/lib/actions/spotify-access";
import { Spinner, useOptimisticList } from "@/components/optimistic";
import type { OptimisticMeta } from "@/lib/optimistic";
import { useI18n } from "@/components/i18n-provider";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

/** Demande d'accès Spotify telle qu'affichée (statut « none » exclu). */
export type SpotifyRequestRow = {
  id: string;
  name: string;
  email: string;
  spotifyAccessStatus: string;
  spotifyAccount: string | null;
  spotifyRequestedAt: Date | null;
} & OptimisticMeta;

/** En attente d'abord, puis approuvés, puis refusés. */
function statusRank(status: string): number {
  return status === "pending" ? 0 : status === "approved" ? 1 : 2;
}

/**
 * Validation des demandes d'accès Spotify, en optimiste : approuver/refuser
 * change le badge et **réordonne** la ligne immédiatement ; révoquer la retire.
 * Tout est annulé si le serveur refuse.
 */
export function SpotifyRequests({
  requests,
  timezone,
}: {
  requests: SpotifyRequestRow[];
  timezone: string;
}) {
  const { t, locale } = useI18n();
  const { items, errors, dismissError, isPending, update, remove } =
    useOptimisticList(requests, { fallbackError: t("err.actionFailed") });

  // L'ordre dépend du statut : on le recalcule pour refléter l'optimisme.
  const ordered = [...items].sort(
    (a, b) =>
      statusRank(a.spotifyAccessStatus) - statusRank(b.spotifyAccessStatus),
  );
  const pendingCount = items.filter(
    (request) => request.spotifyAccessStatus === "pending",
  ).length;

  const approve = (id: string) => {
    update(id, { spotifyAccessStatus: "approved", syncing: true }, async () => {
      const formData = new FormData();
      formData.set("userId", id);
      return approveSpotifyAccess(formData);
    });
  };

  const reject = (id: string) => {
    update(id, { spotifyAccessStatus: "rejected", syncing: true }, async () => {
      const formData = new FormData();
      formData.set("userId", id);
      return rejectSpotifyAccess(formData);
    });
  };

  const revoke = (id: string, name: string) => {
    if (!window.confirm(t("settings.confirmRevoke", { name }))) return;
    remove(id, async () => {
      const formData = new FormData();
      formData.set("userId", id);
      return revokeSpotifyAccess(formData);
    });
  };

  return (
    <Card>
      <SectionTitle
        title={t("settings.spotifyRequests")}
        subtitle={t("settings.spotifyRequestsSubtitle")}
        action={
          pendingCount > 0 ? (
            <Badge tone="violet">{pendingCount}</Badge>
          ) : undefined
        }
      />
      {ordered.length === 0 ? (
        <EmptyState>{t("settings.spotifyNoRequests")}</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {ordered.map((request) => {
            const pending = request.spotifyAccessStatus === "pending";
            const approved = request.spotifyAccessStatus === "approved";
            const syncing = request.syncing || isPending(request.id);
            const rowError = errors[request.id];

            return (
              <li
                key={request.id}
                className={`flex flex-wrap items-center justify-between gap-3 py-3 transition-opacity duration-200 ${
                  syncing ? "opacity-60" : "opacity-100"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {syncing ? <Spinner className="text-accent" /> : null}
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
                            timezone,
                            locale,
                          ),
                        })}`
                      : null}
                  </p>
                  {rowError ? (
                    <button
                      type="button"
                      onClick={() => dismissError(request.id)}
                      title={t("settings.dismiss")}
                      className="mt-1 text-left text-xs text-red-400"
                    >
                      {rowError}
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {pending ? (
                    <>
                      <button
                        type="button"
                        onClick={() => approve(request.id)}
                        disabled={syncing}
                        className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {t("settings.spotifyApprove")}
                      </button>
                      <button
                        type="button"
                        onClick={() => reject(request.id)}
                        disabled={syncing}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                      >
                        {t("settings.spotifyReject")}
                      </button>
                    </>
                  ) : approved ? (
                    <button
                      type="button"
                      onClick={() => revoke(request.id, request.name)}
                      disabled={syncing}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                    >
                      {t("settings.spotifyRevoke")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => approve(request.id)}
                      disabled={syncing}
                      className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {t("settings.spotifyApprove")}
                    </button>
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
