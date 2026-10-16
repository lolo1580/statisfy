import {
  SETTING_ALLOW_REGISTRATION,
  getMinListenRatio,
  getSetting,
} from "@/lib/settings";
import { setMinListenRatio, setRegistration } from "@/lib/actions/connections";
import { RestoreForm } from "@/components/admin-forms";
import { Card, SectionTitle } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/** Réglages de l'instance : inscriptions, export et restauration de la base. */
export default async function AdminInstancePage() {
  const { t } = await getI18n();
  const registrationStored = await getSetting(SETTING_ALLOW_REGISTRATION);
  const registrationEnabled =
    registrationStored === null
      ? process.env.ALLOW_REGISTRATION !== "false"
      : registrationStored === "true";
  const minListenRatio = await getMinListenRatio();

  return (
    <div className="space-y-6">
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
            <p className="mt-1 text-xs text-muted">
              {t("admin.exportDbHint")}
            </p>
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
