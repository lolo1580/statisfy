"use client";

import { useActionState, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { inputClass } from "@/components/form-ui";
import {
  deleteOwnAccount,
  type DeleteAccountState,
} from "@/lib/actions/account";

/** Suppression définitive du compte, avec confirmation et mot de passe. */
export function DeleteAccountForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(
    deleteOwnAccount,
    undefined,
  );
  const [confirmed, setConfirmed] = useState(false);

  return (
    <form action={action} className="space-y-3">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="confirm"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-0.5 accent-danger"
        />
        <span>{t("settings.deleteAccountConfirm")}</span>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">
          {t("settings.deleteAccountPassword")}
        </span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          disabled={!confirmed}
          className={inputClass}
        />
      </label>
      {state?.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!confirmed || pending}
        className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? t("settings.deleting") : t("settings.deleteAccountCta")}
      </button>
    </form>
  );
}
