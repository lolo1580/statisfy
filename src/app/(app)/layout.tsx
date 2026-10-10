import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { logout } from "@/lib/auth/actions";
import { Nav } from "@/components/nav";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getI18n } from "@/i18n/server";
import { appName } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 xl:max-w-7xl 3xl:max-w-[1720px] 4xl:max-w-[2000px]">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span aria-hidden>🎧</span>
          {appName}
        </Link>
        <Nav />
        <form action="/search" className="order-last w-full sm:order-none sm:w-56">
          <input
            type="search"
            name="q"
            placeholder={t("shell.searchPlaceholder")}
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent"
          />
        </form>
        <div className="flex items-center gap-3 text-sm">
          <LocaleSwitcher current={locale} />
          <span className="hidden text-muted sm:inline">{user.name}</span>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-1.5 text-muted transition-colors hover:border-red-500/40 hover:text-red-400"
            >
              {t("nav.logout")}
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
