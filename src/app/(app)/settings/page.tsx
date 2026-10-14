import { getCurrentUser } from "@/lib/auth/dal";
import { updateTimezone } from "@/lib/actions/connections";
import { ChangePasswordForm } from "@/components/admin-forms";
import { Card, SectionTitle } from "@/components/ui";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/** Réglages du compte : fuseau horaire et mot de passe. */
export default async function SettingsAccountPage() {
  const user = await getCurrentUser();
  const { t } = await getI18n();

  const timezones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [user.timezone];

  return (
    <Card>
      <SectionTitle
        title={t("settings.account")}
        subtitle={`${user.name} · ${user.email}`}
      />
      <form action={updateTimezone} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <label htmlFor="timezone" className="mb-1 block text-sm text-muted">
            {t("settings.timezone")}
          </label>
          <select
            id="timezone"
            name="timezone"
            defaultValue={user.timezone}
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:border-accent/40 hover:text-accent"
        >
          {t("settings.save")}
        </button>
      </form>
      <div className="mt-4 border-t border-border pt-4">
        <h3 className="text-sm font-medium">{t("settings.changePassword")}</h3>
        <ChangePasswordForm />
      </div>
    </Card>
  );
}
