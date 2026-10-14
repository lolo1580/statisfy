import { getCurrentUser } from "@/lib/auth/dal";
import { appUrl } from "@/lib/env";
import { requestOrigin } from "@/lib/sources/spotify-state";
import { getWrappedShareToken } from "@/lib/wrapped-share";
import {
  disableWrappedShare,
  enableWrappedShare,
} from "@/lib/actions/sharing";
import { CopyField } from "@/components/admin-forms";
import { ConfirmForm } from "@/components/confirm-form";
import { Card, SectionTitle } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/** Données personnelles : export de l'historique et partage du récapitulatif. */
export default async function SettingsDataPage() {
  const user = await getCurrentUser();
  const { t } = await getI18n();

  const wrappedShareToken = await getWrappedShareToken(user.id);
  // Origine publique pour construire des liens absolus.
  const shareOrigin = (await requestOrigin()) ?? appUrl;

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle
          title={t("settings.export")}
          subtitle={t("settings.exportHint")}
        />
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/export"
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:border-accent/40 hover:text-accent"
          >
            {t("settings.exportCsv")}
          </a>
        </div>
      </Card>

      <Card>
        <SectionTitle
          title={t("settings.share")}
          subtitle={t("settings.shareSubtitle")}
        />
        {wrappedShareToken ? (
          <div className="space-y-3">
            <CopyField
              value={`${shareOrigin}/share/wrapped/${wrappedShareToken}`}
              label={t("settings.shareLink")}
            />
            <div className="flex flex-wrap gap-2">
              <form action={enableWrappedShare}>
                <button
                  type="submit"
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent"
                >
                  {t("settings.shareRegenerate")}
                </button>
              </form>
              <ConfirmForm
                action={disableWrappedShare}
                fields={{}}
                message={t("settings.confirmUnshare")}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
              >
                {t("settings.shareDisable")}
              </ConfirmForm>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">{t("settings.shareHint")}</p>
            <form action={enableWrappedShare}>
              <button
                type="submit"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#04140d] transition-opacity hover:opacity-90"
              >
                {t("settings.shareEnable")}
              </button>
            </form>
          </div>
        )}
      </Card>
    </div>
  );
}
