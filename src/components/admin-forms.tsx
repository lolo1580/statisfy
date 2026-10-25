"use client";

import { useActionState, useState } from "react";
import {
  changePassword,
  resetUserPassword,
  type AdminState,
} from "@/lib/actions/users";
import { restoreBackup, type RestoreState } from "@/lib/actions/backup";
import { testLogSink, type LogTestState } from "@/lib/actions/logs";
import { useI18n } from "@/components/i18n-provider";
import { useToast } from "@/components/toast";
import { Feedback, inputClass } from "@/components/form-ui";

/** Champ en lecture seule avec bouton « Copier » (lien d'invitation). */
export function CopyField({ value, label }: { value: string; label?: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast(t("settings.copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(t("settings.copyFailed"), "error");
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
        <span className="max-w-[260px] text-right text-xs text-danger">
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

/** Restauration d'une sauvegarde PostgreSQL (admin). */
export function RestoreForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<RestoreState, FormData>(
    restoreBackup,
    undefined,
  );

  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={(event) => {
        if (!window.confirm(t("settings.confirmRestore"))) {
          event.preventDefault();
        }
      }}
    >
      <input
        type="file"
        name="file"
        accept=".dump,application/octet-stream"
        required
        className="block w-full cursor-pointer rounded-lg border border-dashed border-border bg-surface-2 px-3 py-6 text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-accent"
      />
      <p className="text-xs text-muted">{t("settings.restoreHint")}</p>
      <Feedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-danger/40 px-4 py-2 text-sm text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
      >
        {pending ? t("settings.restoring") : t("settings.restoreCta")}
      </button>
    </form>
  );
}

/** Bouton de test de l'envoi vers le serveur de logs externe (admin). */
export function TestLogSinkButton() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<LogTestState, FormData>(
    testLogSink,
    undefined,
  );

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
        >
          {pending ? t("admin.logTestSending") : t("admin.logTest")}
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}
