"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/components/i18n-provider";

/**
 * Panneau d'erreur réutilisable (frontières `error.tsx` du shell et de la
 * racine). Le `digest` permet de retrouver l'erreur côté serveur sans exposer
 * de détail sensible au client.
 */
export function ErrorPanel({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-5 py-16 text-center">
      <p className="text-4xl" aria-hidden>
        ⚠️
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        {t("error.title")}
      </h1>
      <p className="mt-2 text-sm text-muted">{t("error.body")}</p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-muted">
          {t("error.digest", { digest: error.digest })}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
        >
          {t("error.retry")}
        </button>
        <Link
          href="/"
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent/40 hover:text-accent"
        >
          {t("error.home")}
        </Link>
      </div>
    </main>
  );
}
