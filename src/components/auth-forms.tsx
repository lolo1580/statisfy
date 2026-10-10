"use client";

import { useActionState } from "react";
import { login, register, type AuthState } from "@/lib/auth/actions";
import { useI18n } from "@/components/i18n-provider";

const inputClass =
  "w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-red-400">{messages[0]}</p>;
}

export function LoginForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AuthState, FormData>(
    login,
    undefined,
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-muted">
          {t("auth.email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.values?.email}
          className={inputClass}
          placeholder={t("auth.emailPlaceholder")}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-muted">
          {t("auth.password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
          placeholder="••••••••"
        />
      </div>
      {state?.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#04140d] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("auth.signingIn") : t("auth.signIn")}
      </button>
    </form>
  );
}

export function RegisterForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AuthState, FormData>(
    register,
    undefined,
  );

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm text-muted">
          {t("auth.name")}
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={state?.values?.name}
          className={inputClass}
          placeholder={t("auth.namePlaceholder")}
        />
        <FieldError messages={state?.fieldErrors?.name} />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm text-muted">
          {t("auth.email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.values?.email}
          className={inputClass}
          placeholder={t("auth.emailPlaceholder")}
        />
        <FieldError messages={state?.fieldErrors?.email} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm text-muted">
          {t("auth.password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className={inputClass}
          placeholder={t("auth.passwordHint")}
        />
        <FieldError messages={state?.fieldErrors?.password} />
      </div>
      {state?.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#04140d] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("auth.creating") : t("auth.createAccountCta")}
      </button>
    </form>
  );
}
