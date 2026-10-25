import type { Metadata } from "next";
import Link from "next/link";
import { SwaggerUi } from "@/components/swagger-ui";
import { getI18n } from "@/i18n/server";
import { appName } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "API documentation",
  description: "Interactive OpenAPI reference for this Statisfy instance.",
};

/**
 * Documentation publique de l'API (Swagger UI).
 *
 * Aucune donnée n'est exposée : la page ne contient que le contrat OpenAPI.
 * Les appels « Try it out » nécessitent un jeton fourni par l'utilisateur.
 */
export default async function ApiDocsPage() {
  const { t } = await getI18n();

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 xl:max-w-7xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">
            {t("apiDocs.kicker")}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("apiDocs.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            {t("apiDocs.subtitle", { name: appName })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <a
            href="/api/docs/openapi.json"
            className="rounded-lg border border-border px-3 py-2 text-muted transition-colors hover:border-accent/40 hover:text-accent"
          >
            {t("apiDocs.openSpec")}
          </a>
          <Link
            href="/dashboard"
            className="rounded-lg border border-border px-3 py-2 text-muted transition-colors hover:border-accent/40 hover:text-accent"
          >
            {t("apiDocs.back")}
          </Link>
        </div>
      </header>

      <SwaggerUi specUrl="/api/docs/openapi.json" />
    </main>
  );
}
