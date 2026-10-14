import { ImportForm, YourSpotifyImportForm } from "@/components/settings-forms";
import { Card, SectionTitle } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/** Imports d'historique : export Spotify et dump Your Spotify. */
export default async function SettingsImportPage() {
  const { t } = await getI18n();

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle
          title={t("settings.import")}
          subtitle={t("settings.importSubtitle")}
        />
        <ImportForm />
      </Card>

      <Card>
        <SectionTitle
          title={t("settings.yourspotify")}
          subtitle={t("settings.yourspotifySubtitle")}
        />
        <YourSpotifyImportForm />
      </Card>
    </div>
  );
}
