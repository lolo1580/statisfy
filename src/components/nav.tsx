"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";

const LINKS = [
  { href: "/dashboard", key: "nav.overview" },
  { href: "/top", key: "nav.rankings" },
  { href: "/wrapped", key: "nav.recap" },
  { href: "/insights", key: "nav.insights" },
  { href: "/history", key: "nav.history" },
  { href: "/status", key: "nav.status" },
  { href: "/settings", key: "nav.settings" },
];

export function Nav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
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
