"use client";

import { deleteConnection } from "@/lib/actions/connections";
import { SyncButton } from "@/components/settings-forms";
import { Spinner, useOptimisticList } from "@/components/optimistic";
import type { OptimisticMeta } from "@/lib/optimistic";
import { useI18n } from "@/components/i18n-provider";
import { Badge, EmptyState } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

/** Source connectée telle qu'affichée dans les réglages. */
export type ConnectionRow = {
  id: string;
  displayName: string;
  type: string;
  status: string;
  lastSyncedAt: Date | null;
  lastError: string | null;
} & OptimisticMeta;

/**
 * Liste des sources connectées. La suppression est optimiste : la ligne
 * disparaît aussitôt et réapparaît si le serveur refuse.
 */
export function ConnectionsList({
  connections,
  timezone,
}: {
  connections: ConnectionRow[];
  timezone: string;
}) {
  const { t, locale } = useI18n();
  const { items, errors, dismissError, isPending, remove } = useOptimisticList(
    connections,
    { fallbackError: t("err.actionFailed") },
  );

  const sourceLabel = (value: string) =>
    value === "spotify"
      ? t("source.spotify")
      : value === "import"
        ? t("source.import")
        : value;

  const deleteSource = (id: string) => {
    remove(id, async () => {
      const formData = new FormData();
      formData.set("connectionId", id);
      return deleteConnection(formData);
    });
  };

  if (items.length === 0) {
    return <EmptyState>{t("settings.noSources")}</EmptyState>;
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((connection) => {
        const rowError = errors[connection.id];
        const pending = connection.syncing || isPending(connection.id);

        return (
          <li
            key={connection.id}
            className={`flex flex-wrap items-center justify-between gap-3 py-3 transition-opacity duration-200 ${
              pending ? "opacity-60" : "opacity-100"
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {pending ? <Spinner className="text-accent" /> : null}
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
                    ? formatDateTime(connection.lastSyncedAt, timezone, locale)
                    : t("status.never"),
                })}
              </p>
              {connection.lastError ? (
                <p className="mt-0.5 text-xs text-danger">
                  {connection.lastError}
                </p>
              ) : null}
              {rowError ? (
                <button
                  type="button"
                  onClick={() => dismissError(connection.id)}
                  title={t("settings.dismiss")}
                  className="mt-1 text-left text-xs text-danger"
                >
                  {rowError}
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <SyncButton connectionId={connection.id} />
              <button
                type="button"
                onClick={() => deleteSource(connection.id)}
                disabled={pending}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50"
              >
                {t("settings.delete")}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
