import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth-forms";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { readSession } from "@/lib/auth/session";
import { registrationAllowed } from "@/lib/settings";
import { prisma } from "@/lib/db";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await readSession()) redirect("/dashboard");

  const userCount = await prisma.user.count();
  // Le premier compte est toujours autorisé (bootstrap de l'instance).
  if (userCount > 0 && !(await registrationAllowed())) {
    redirect("/login");
  }

  const { locale, t } = await getI18n();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-4 flex justify-end">
        <LocaleSwitcher current={locale} />
      </div>
      <div className="mb-8 text-center">
        <div className="mb-2 text-3xl">🎧</div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("auth.signUpTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {userCount === 0 ? t("auth.firstUser") : t("auth.join")}
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-surface/70 p-6 backdrop-blur">
        <RegisterForm />
      </div>
      <p className="mt-4 text-center text-sm text-muted">
        {t("auth.alreadyAccount")}{" "}
        <Link href="/login" className="text-accent hover:underline">
          {t("auth.signIn")}
        </Link>
      </p>
    </main>
  );
}
