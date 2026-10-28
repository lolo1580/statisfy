"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";

export type JobProgress = {
  status: string;
  total: number;
  processed: number;
  inserted: number;
  error: string | null;
};

/** Identifiant de suivi (UUID natif, ou repli non sécurisé). */
export function newImportRunId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

type Entry = { runId: string; job: JobProgress };

/**
 * Interroge `/api/jobs/<runId>` pendant qu'une action d'import s'exécute.
 * L'action et les requêtes de polling sont servies en parallèle par le serveur
 * Node : la progression est donc visible en temps réel.
 */
export function useImportProgress(
  active: boolean,
  runId: string,
): JobProgress | null {
  const [entry, setEntry] = useState<Entry | null>(null);

  useEffect(() => {
    if (!active || !runId) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/jobs/${encodeURIComponent(runId)}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const job = (await response.json()) as JobProgress;
        if (!cancelled) setEntry({ runId, job });
      } catch {
        // Réseau : le prochain tick réessaiera.
      }
    };

    void poll();
    const timer = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active, runId]);

  // Ignore l'avancement d'un import précédent (nouvel identifiant).
  return active && entry?.runId === runId ? entry.job : null;
}

/** Barre de progression d'import (indéterminée tant que le total est inconnu). */
export function ImportProgressBar({ job }: { job: JobProgress | null }) {
  const { locale, t } = useI18n();
  const total = job?.total ?? 0;
  const processed = job ? Math.min(job.processed, total) : 0;
  const percent = total > 0 ? Math.round((processed / total) * 100) : null;

  return (
    <div className="space-y-1" role="status" aria-live="polite">
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        {percent === null ? (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
        ) : (
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
      <p className="text-xs text-muted">
        {percent === null
          ? t("settings.importAnalyzing")
          : t("settings.importProgress", {
              done: new Intl.NumberFormat(locale).format(processed),
              total: new Intl.NumberFormat(locale).format(total),
              percent,
            })}
      </p>
    </div>
  );
}
