"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";

const LINKS = [
  { href: "/admin", key: "admin.nav.overview" },
  { href: "/admin/users", key: "admin.nav.users" },
  { href: "/admin/invitations", key: "admin.nav.invitations" },
  { href: "/admin/spotify", key: "admin.nav.spotify" },
  { href: "/admin/logs", key: "admin.nav.logs" },
  { href: "/admin/instance", key: "admin.nav.instance" },
] as const;

/** Onglets de l'espace d'administration (une section par page). */
export function AdminNav({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav
      aria-label={t("admin.title")}
      className="flex flex-wrap gap-1 border-b border-border pb-3"
    >
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {t(link.key)}
            {link.href === "/admin/spotify" && pendingCount > 0 ? (
              <span
                title={t("nav.pendingRequests", { count: pendingCount })}
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white"
              >
                {pendingCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
