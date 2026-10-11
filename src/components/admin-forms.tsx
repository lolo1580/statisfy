"use client";

import { useActionState, useState } from "react";
import {
  changePassword,
  createInvitationAction,
  resetUserPassword,
  type AdminState,
} from "@/lib/actions/users";
import { INVITATION_TTL_CHOICES } from "@/lib/invitation-rules";
import { useI18n } from "@/components/i18n-provider";
import { Feedback, inputClass } from "@/components/form-ui";

/** Champ en lecture seule avec bouton « Copier » (lien d'invitation). */
export function CopyField({ value, label }: { value: string; label?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Le champ reste sélectionnable manuellement.
    }
  };

  return (
    <div className="flex items-center gap-2">
      {label ? <span className="text-xs text-muted">{label}</span> : null}
      <input
        readOnly
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2 py-1 text-xs text-muted outline-none focus:border-accent"
      />
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent"
      >
        {copied ? t("settings.copied") : t("settings.copy")}
      </button>
    </div>
  );
}

/** Formulaire de création d'un lien d'invitation (admin). */
export function InviteForm({ origin }: { origin: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AdminState, FormData>(
    createInvitationAction,
    undefined,
  );

  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="invite-email" className="mb-1 block text-xs text-muted">
            {t("settings.inviteEmail")}
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            className={inputClass}
            placeholder={t("settings.inviteEmailPlaceholder")}
          />
        </div>
        <div>
          <label htmlFor="invite-days" className="mb-1 block text-xs text-muted">
            {t("settings.inviteDays")}
          </label>
          <select
            id="invite-days"
            name="days"
            defaultValue="7"
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {INVITATION_TTL_CHOICES.map((days) => (
              <option key={days} value={days}>
                {t("settings.inviteDaysValue", { days })}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#04140d] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? t("settings.inviteCreating") : t("settings.inviteCreate")}
        </button>
      </form>
      <Feedback state={state} />
      {state?.inviteUrl ? (
        <CopyField
          value={`${origin}${state.inviteUrl}`}
          label={t("settings.inviteCreated")}
        />
      ) : null}
    </div>
  );
}

/** Bouton de réinitialisation du mot de passe d'un compte (admin). */
export function ResetPasswordButton({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AdminState, FormData>(
    resetUserPassword,
    undefined,
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
        >
          {pending ? t("settings.resetting") : t("settings.resetPassword")}
        </button>
      </form>
      {state?.message ? (
        <span className="max-w-[260px] text-right text-xs text-accent">
          {state.message}
        </span>
      ) : null}
      {state?.error ? (
        <span className="max-w-[260px] text-right text-xs text-red-400">
          {state.error}
        </span>
      ) : null}
    </div>
  );
}

/** Changement de son propre mot de passe. */
export function ChangePasswordForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AdminState, FormData>(
    changePassword,
    undefined,
  );

  return (
    <form action={action} className="mt-4 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <label
            htmlFor="currentPassword"
            className="mb-1 block text-xs text-muted"
          >
            {t("settings.currentPassword")}
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </div>
        <div className="min-w-[180px] flex-1">
          <label htmlFor="newPassword" className="mb-1 block text-xs text-muted">
            {t("settings.newPassword")}
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className={inputClass}
            placeholder={t("auth.passwordHint")}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
        >
          {t("settings.changePassword")}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}
