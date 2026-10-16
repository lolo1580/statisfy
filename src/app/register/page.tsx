import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth-forms";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { readSession } from "@/lib/auth/session";
import { registrationAllowed } from "@/lib/settings";
import { findUsableInvitation } from "@/lib/invitations";
import { prisma } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { THEME_COOKIE, defaultTheme, isTheme } from "@/lib/theme";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: PageProps<"/register">) {
  if (await readSession()) redirect("/dashboard");

  const params = await searchParams;
  const rawInvite = params.invite;
  const inviteToken =
    typeof rawInvite === "string" ? rawInvite.trim() : undefined;
  const invitation = inviteToken
    ? await findUsableInvitation(inviteToken)
    : null;

  const userCount = await prisma.user.count();
  const canRegister = userCount === 0 || (await registrationAllowed());
  // Le premier compte est toujours autorisé ; sinon il faut une invitation
  // valide pour contourner la fermeture des inscriptions.
  if (!canRegister && !invitation) {
    redirect("/login");
  }

  const { locale, t } = await getI18n();
  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(themeCookie) ? themeCookie : defaultTheme;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-4 flex justify-end gap-2">
        <ThemeSwitcher current={theme} />
        <LocaleSwitcher current={locale} />
      </div>
      <div className="mb-8 text-center">
        <div className="mb-2 text-3xl" aria-hidden>🎧</div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("auth.signUpTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {invitation
            ? t("auth.invited")
            : userCount === 0
              ? t("auth.firstUser")
              : t("auth.join")}
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-surface/70 p-6 backdrop-blur">
        <RegisterForm
          invite={invitation?.token}
          lockedEmail={invitation?.email ?? undefined}
        />
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
