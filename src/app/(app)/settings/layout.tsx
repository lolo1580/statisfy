import { Suspense } from "react";
import { SettingsNav } from "@/components/settings-nav";
import { SettingsNotice } from "@/components/settings-notice";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/** En-tête des Réglages + onglets, communs à toutes les sous-pages. */
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = await getI18n();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("settings.title")}
      </h1>
      <Suspense fallback={null}>
        <SettingsNotice />
      </Suspense>
      <SettingsNav />
      {children}
    </div>
  );
}
