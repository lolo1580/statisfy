import { ImportForm, YourSpotifyImportForm } from "@/components/settings-forms";
import { Card, SectionTitle } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Page « Confidentialité » de Spotify : on y demande le paquet de données
 * (cocher « Extended streaming history ») avant de l'importer ici.
 */
const SPOTIFY_DATA_REQUEST_URL = "https://www.spotify.com/account/privacy/";

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
        <p className="mb-3 text-sm">
          <a
            href={SPOTIFY_DATA_REQUEST_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            {t("settings.importRequest")}
            <span aria-hidden>↗</span>
          </a>
        </p>
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
