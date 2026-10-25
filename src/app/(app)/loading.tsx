import { getI18n } from "@/i18n/server";

/**
 * Squelette affiché pendant la navigation entre les pages du shell.
 * Volontairement léger : aucune requête base, juste des blocs pulsés.
 */
export default async function AppLoading() {
  const { t } = await getI18n();

  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only">{t("common.loading")}</span>
      <div className="space-y-2">
        <div className="h-7 w-52 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-4 w-72 animate-pulse rounded bg-surface-2/70" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-2xl border border-border bg-surface/70"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-surface/70" />
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-surface/70" />
      </div>
    </div>
  );
}
