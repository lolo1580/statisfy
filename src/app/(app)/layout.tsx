import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/dal";
import { logout } from "@/lib/auth/actions";
import { Nav } from "@/components/nav";
import { CommandPalette } from "@/components/command-palette";
import { OpenObserveRum } from "@/components/openobserve-rum";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { getI18n } from "@/i18n/server";
import { getRumConfig, toClientRumConfig } from "@/lib/rum";
import { appName, appVersion } from "@/lib/env";
import { prisma } from "@/lib/db";
import { THEME_COOKIE, defaultTheme, isTheme } from "@/lib/theme";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(themeCookie) ? themeCookie : defaultTheme;
  const rum = await getRumConfig();

  // Badge d'action pour l'administrateur : demandes d'accès Spotify à traiter.
  const pendingRequests = user.isAdmin
    ? await prisma.user.count({ where: { spotifyAccessStatus: "pending" } })
    : 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 xl:max-w-7xl 3xl:max-w-[1720px] 4xl:max-w-[2000px]">
      <header className="relative mb-8 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span aria-hidden>🎧</span>
          {appName}
        </Link>
        <Nav pendingCount={pendingRequests} isAdmin={user.isAdmin} />
        <div className="order-last w-full sm:order-none sm:max-w-2xl sm:flex-1">
          <CommandPalette isAdmin={user.isAdmin} />
        </div>
        <div className="flex items-center gap-3 text-sm">
          <ThemeSwitcher current={theme} />
          <LocaleSwitcher current={locale} />
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-2 text-muted transition-colors hover:border-danger/40 hover:text-danger"
            >
              {t("nav.logout")}
            </button>
          </form>
        </div>
      </header>
      <OpenObserveRum config={rum ? toClientRumConfig(rum) : null} />
      {children}
      <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-xs text-muted">
        <a
          href="https://www.spotify.com"
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-accent"
        >
          {t("shell.spotifyAttribution")}
        </a>
        <div className="flex items-center gap-3">
          <Link
            href="/api-docs"
            className="transition-colors hover:text-accent"
          >
            {t("apiDocs.title")}
          </Link>
          <span title={`${appName} ${appVersion}`}>v{appVersion}</span>
        </div>
      </footer>
    </div>
  );
}
