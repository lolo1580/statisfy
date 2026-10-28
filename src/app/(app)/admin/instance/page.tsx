import {
  SETTING_ALLOW_REGISTRATION,
  getMinListenRatio,
  getSetting,
} from "@/lib/settings";
import { setMinListenRatio, setRegistration } from "@/lib/actions/connections";
import { getWebhookConfig } from "@/lib/webhook";
import {
  getRumConfig,
  getRumSettings,
  getRumStatus,
  isRumForcedOffByEnv,
} from "@/lib/rum";
import { RumForm } from "@/components/rum-form";
import { formatRelative } from "@/lib/format";
import { RestoreForm } from "@/components/admin-forms";
import { WebhookForm } from "@/components/webhook-form";
import { Card, SectionTitle } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/** Réglages de l'instance : inscriptions, export et restauration de la base. */
export default async function AdminInstancePage() {
  const { locale, t } = await getI18n();
  const registrationStored = await getSetting(SETTING_ALLOW_REGISTRATION);
  const registrationEnabled =
    registrationStored === null
      ? process.env.ALLOW_REGISTRATION !== "false"
      : registrationStored === "true";
  const minListenRatio = await getMinListenRatio();
  const webhook = await getWebhookConfig();
  const rum = await getRumConfig();
  const rumSettings = await getRumSettings();
  const rumStatus = await getRumStatus();
  const rumForcedOff = isRumForcedOffByEnv();
  const { token: rumToken, ...rumFormSettings } = rumSettings;
  const rumTokenHint = rumToken ? `••••${rumToken.slice(-4)}` : null;
  const rumLastEvent = rumStatus.lastEventAt
    ? formatRelative(new Date(rumStatus.lastEventAt), locale)
    : null;
  const rumLastError = rumStatus.lastErrorAt
    ? formatRelative(new Date(rumStatus.lastErrorAt), locale)
    : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle
            title={t("admin.registrationTitle")}
            subtitle={t("admin.registrationSubtitle")}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {t("settings.registration", {
                state: registrationEnabled
                  ? t("settings.allowed")
                  : t("settings.disabled"),
              })}
            </p>
            <form action={setRegistration}>
              <input
                type="hidden"
                name="enabled"
                value={registrationEnabled ? "false" : "true"}
              />
              <button
                type="submit"
                className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:border-accent/40 hover:text-accent"
              >
                {registrationEnabled
                  ? t("settings.disableReg")
                  : t("settings.enableReg")}
              </button>
            </form>
          </div>
        </Card>

        <Card>
          <SectionTitle
            title={t("admin.thresholdTitle")}
            subtitle={t("admin.thresholdSubtitle")}
          />
          <form
            action={setMinListenRatio}
            className="flex flex-wrap items-end gap-3"
          >
            <label className="flex flex-col gap-1 text-xs text-muted">
              {t("admin.thresholdLabel")}
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  name="percent"
                  min={0}
                  max={100}
                  step={5}
                  defaultValue={Math.round(minListenRatio * 100)}
                  className="w-24 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
                <span>%</span>
              </span>
            </label>
            <button
              type="submit"
              className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:border-accent/40 hover:text-accent"
            >
              {t("admin.thresholdSave")}
            </button>
          </form>
        </Card>
      </div>

      <Card>
        <SectionTitle
          title={t("admin.webhookTitle")}
          subtitle={t("admin.webhookSubtitle")}
        />
        <WebhookForm url={webhook.url} secret={webhook.secret} />
      </Card>

      <Card>
        <SectionTitle
          title={t("admin.rumTitle")}
          subtitle={t("admin.rumSubtitle")}
        />
        <p className="text-sm text-muted">
          {rum
            ? t("admin.rumEnabled", {
                site: rum.site,
                org: rum.organizationIdentifier,
                rate: String(Math.round(rum.sessionSampleRate)),
              })
            : t("admin.rumDisabled")}
        </p>
        {rumStatus.lastEventAt || rumStatus.lastErrorAt || rum ? (
          <div className="mt-1 space-y-0.5 text-xs">
            {rumStatus.lastEventAt && rumLastEvent ? (
              <p className="text-muted">
                {t("admin.rumLastEvent", {
                  when: rumLastEvent,
                  track: rumStatus.lastTrack ?? "rum",
                })}
              </p>
            ) : rum ? (
              <p className="text-muted">{t("admin.rumNoEvent")}</p>
            ) : null}
            {rumStatus.lastErrorAt && rumLastError ? (
              <p className="text-danger">
                {rumStatus.lastErrorStatus
                  ? t("admin.rumLastError", {
                      when: rumLastError,
                      status: String(rumStatus.lastErrorStatus),
                    })
                  : t("admin.rumLastErrorNetwork", { when: rumLastError })}
              </p>
            ) : null}
          </div>
        ) : null}
        {rum ? (
          <a
            href={`${rum.insecureHTTP ? "http" : "https"}://${rum.site}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-xs text-accent hover:underline"
          >
            {t("admin.rumOpen")}
          </a>
        ) : null}
        <div className="mt-4">
          <RumForm
            settings={rumFormSettings}
            hasToken={Boolean(rumToken)}
            tokenHint={rumTokenHint}
            forcedOff={rumForcedOff}
          />
        </div>
      </Card>

      <Card>
        <SectionTitle
          title={t("admin.backupTitle")}
          subtitle={t("admin.backupSubtitle")}
        />
        <div className="space-y-4">
          <div>
            <a
              href="/api/export/db"
              className="inline-block rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:border-accent/40 hover:text-accent"
            >
              {t("settings.exportDb")}
            </a>
            <p className="mt-1 text-xs text-muted">{t("admin.exportDbHint")}</p>
          </div>
          <div className="border-t border-border pt-4">
            <h3 className="mb-3 text-sm font-medium">
              {t("settings.restore")}
            </h3>
            <RestoreForm />
          </div>
        </div>
      </Card>
    </div>
  );
}
