import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { readSession } from "@/lib/auth/session";
import { registrationAllowed } from "@/lib/settings";
import { appName } from "@/lib/env";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await readSession()) redirect("/dashboard");
  const canRegister = await registrationAllowed();
  const { locale, t } = await getI18n();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-4 flex justify-end">
        <LocaleSwitcher current={locale} />
      </div>
      <div className="mb-8 text-center">
        <div className="mb-2 text-3xl" aria-hidden>🎧</div>
        <h1 className="text-2xl font-semibold tracking-tight">{appName}</h1>
        <p className="mt-1 text-sm text-muted">{t("auth.tagline")}</p>
      </div>
      <div className="rounded-2xl border border-border bg-surface/70 p-6 backdrop-blur">
        <LoginForm />
      </div>
      {canRegister ? (
        <p className="mt-4 text-center text-sm text-muted">
          {t("auth.noAccount")}{" "}
          <Link href="/register" className="text-accent hover:underline">
            {t("auth.createAccount")}
          </Link>
        </p>
      ) : null}
    </main>
  );
}
