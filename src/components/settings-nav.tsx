"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";

const LINKS = [
  { href: "/settings", key: "settings.nav.account" },
  { href: "/settings/sources", key: "settings.nav.sources" },
  { href: "/settings/import", key: "settings.nav.import" },
  { href: "/settings/activity", key: "settings.nav.activity" },
  { href: "/settings/data", key: "settings.nav.data" },
] as const;

/** Onglets de la page Réglages (une section par page). */
export function SettingsNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav
      aria-label={t("settings.title")}
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
          </Link>
        );
      })}
    </nav>
  );
}
