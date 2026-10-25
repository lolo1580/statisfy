import { getCurrentUser } from "@/lib/auth/dal";
import { appUrl } from "@/lib/env";
import { requestOrigin } from "@/lib/sources/spotify-state";
import { getWrappedShareToken } from "@/lib/wrapped-share";
import { getStatsApiToken } from "@/lib/api/public-stats";
import { getProfileShare, DEFAULT_PROFILE_SHARE_CONFIG } from "@/lib/profile-share";
import {
  disableProfileShare,
  disableWrappedShare,
  enableProfileShare,
  enableWrappedShare,
  updateProfileShareConfig,
} from "@/lib/actions/sharing";
import {
  disableStatsApi,
  enableStatsApi,
} from "@/lib/actions/stats-api";
import { CopyField } from "@/components/admin-forms";
import { ConfirmForm } from "@/components/confirm-form";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { QrCode } from "@/components/qr-code";
import { SettingsDataNav } from "@/components/settings-data-nav";
import { Card, SectionTitle } from "@/components/ui";
import {
  isSettingsDataSection,
  type SettingsDataSection,
} from "@/lib/settings-data";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/** Données personnelles : export de l'historique et partage du récapitulatif. */
export default async function SettingsDataPage({
  searchParams,
}: PageProps<"/settings/data">) {
  const user = await getCurrentUser();
  const { t } = await getI18n();
  const sp = await searchParams;
  const section: SettingsDataSection = isSettingsDataSection(sp.section)
    ? sp.section
    : "export";

  const wrappedShareToken =
    section === "sharing" ? await getWrappedShareToken(user.id) : null;
  const profileShare =
    section === "sharing" ? await getProfileShare(user.id) : null;
  const statsApiToken =
    section === "api" ? await getStatsApiToken(user.id) : null;
  const profileShareToken = profileShare?.token ?? null;
  const profileShareConfig =
    profileShare?.config ?? DEFAULT_PROFILE_SHARE_CONFIG;
  // Origine publique pour construire des liens absolus.
  const shareOrigin = (await requestOrigin()) ?? appUrl;

  return (
    <div className="space-y-6">
      <SettingsDataNav current={section} />

      {section === "export" ? (
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
      ) : null}

      {section === "sharing" ? (
        <>
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
                <QrCode
                  value={`${shareOrigin}/share/wrapped/${wrappedShareToken}`}
                  label={t("settings.qrCode")}
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
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-danger/40 hover:text-danger"
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
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
                  >
                    {t("settings.shareEnable")}
                  </button>
                </form>
              </div>
            )}
          </Card>

      <Card>
        <SectionTitle
          title={t("settings.profileShare")}
          subtitle={t("settings.profileShareSubtitle")}
        />
        {profileShareToken ? (
          <div className="space-y-3">
            <CopyField
              value={`${shareOrigin}/share/profile/${profileShareToken}`}
              label={t("settings.shareLink")}
            />
            <QrCode
              value={`${shareOrigin}/share/profile/${profileShareToken}`}
              label={t("settings.qrCode")}
            />
            <p className="text-xs text-muted">
              {t("settings.profileShareHint")}
            </p>
            <form action={updateProfileShareConfig} className="space-y-2">
              <div className="flex flex-wrap gap-4 text-sm">
                {(
                  [
                    ["topArtists", "settings.profileShareTopArtists"],
                    ["topTracks", "settings.profileShareTopTracks"],
                    ["recentPlays", "settings.profileShareRecent"],
                    ["heatmap", "settings.profileShareHeatmap"],
                  ] as const
                ).map(([name, key]) => (
                  <label key={name} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name={name}
                      defaultChecked={profileShareConfig[name]}
                    />
                    {t(key)}
                  </label>
                ))}
              </div>
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent"
              >
                {t("settings.profileShareSave")}
              </button>
            </form>
            <div className="flex flex-wrap gap-2">
              <form action={enableProfileShare}>
                <button
                  type="submit"
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent"
                >
                  {t("settings.shareRegenerate")}
                </button>
              </form>
              <ConfirmForm
                action={disableProfileShare}
                fields={{}}
                message={t("settings.confirmProfileUnshare")}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-danger/40 hover:text-danger"
              >
                {t("settings.shareDisable")}
              </ConfirmForm>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {t("settings.profileShareHintOff")}
            </p>
            <form action={enableProfileShare}>
              <button
                type="submit"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
              >
                {t("settings.shareEnable")}
              </button>
            </form>
          </div>
        )}
      </Card>
        </>
      ) : null}

      {section === "api" ? (
        <Card>
          <SectionTitle
            title={t("settings.api")}
            subtitle={t("settings.apiSubtitle")}
          />
        {statsApiToken ? (
          <div className="space-y-3">
            <CopyField
              value={`${shareOrigin}/api/public/stats?range=30&token=${statsApiToken}`}
              label={t("settings.apiEndpoint")}
            />
            <CopyField
              value={`![Statisfy](${shareOrigin}/api/public/stats/card.svg?token=${statsApiToken})`}
              label={t("settings.apiCard")}
            />
            <p className="text-xs text-muted">{t("settings.apiHintActive")}</p>
            <div className="flex flex-wrap gap-2">
              <form action={enableStatsApi}>
                <button
                  type="submit"
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent"
                >
                  {t("settings.apiRegenerate")}
                </button>
              </form>
              <ConfirmForm
                action={disableStatsApi}
                fields={{}}
                message={t("settings.confirmApiDisable")}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-danger/40 hover:text-danger"
              >
                {t("settings.apiDisable")}
              </ConfirmForm>
              <a
                href="/api-docs"
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent"
              >
                {t("settings.apiDocs")}
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">{t("settings.apiHint")}</p>
            <div className="flex flex-wrap gap-2">
              <form action={enableStatsApi}>
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
                >
                  {t("settings.apiEnable")}
                </button>
              </form>
              <a
                href="/api-docs"
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent/40 hover:text-accent"
              >
                {t("settings.apiDocs")}
              </a>
            </div>
          </div>
        )}
      </Card>
      ) : null}

      {section === "danger" ? (
        <Card className="border-danger/30">
          <SectionTitle
            title={t("settings.danger")}
            subtitle={t("settings.deleteAccountHint")}
          />
          <DeleteAccountForm />
        </Card>
      ) : null}
    </div>
  );
}
