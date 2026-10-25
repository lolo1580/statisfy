import Link from "next/link";
import { getI18n } from "@/i18n/server";

/** Panneau 404 réutilisable (racine et shell applicatif). */
export async function NotFoundPanel() {
  const { t } = await getI18n();

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-5 py-16 text-center">
      <p className="text-4xl" aria-hidden>
        🧭
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        {t("notFound.title")}
      </h1>
      <p className="mt-2 text-sm text-muted">{t("notFound.body")}</p>
      <Link
        href="/"
        className="mt-6 rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent/40 hover:text-accent"
      >
        {t("notFound.home")}
      </Link>
    </main>
  );
}
