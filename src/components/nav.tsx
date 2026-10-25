"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { isActivePath } from "@/lib/nav";

const LINKS = [
  { href: "/dashboard", key: "nav.overview" },
  { href: "/compare", key: "nav.compare" },
  { href: "/wrapped", key: "nav.recap" },
  { href: "/history", key: "nav.history" },
  { href: "/settings", key: "nav.settings" },
];

export function Nav({
  pendingCount = 0,
  isAdmin = false,
}: {
  pendingCount?: number;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const mobileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (
        mobileRef.current &&
        !mobileRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const links = isAdmin
    ? [...LINKS, { href: "/admin", key: "nav.admin" }]
    : LINKS;

  const badge = (href: string) =>
    href === "/admin" && pendingCount > 0 ? (
      <span
        title={t("nav.pendingRequests", { count: pendingCount })}
        className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white"
      >
        {pendingCount}
      </span>
    ) : null;

  return (
    <>
      {/* Barre horizontale (à partir de md) */}
      <nav className="hidden items-center gap-1 md:flex">
        {links.map((link) => {
          const active = isActivePath(pathname, link.href);
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
              {badge(link.href)}
            </Link>
          );
        })}
      </nav>

      {/* Bouton « hamburger » et menu (mobile) */}
      <div ref={mobileRef} className="relative md:contents">
        <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={t("nav.menu")}
        className="rounded-lg border border-border p-2 text-muted transition-colors hover:border-accent/40 hover:text-foreground md:hidden"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      {/* Menu déroulant (mobile) */}
      {open ? (
        <nav
          id="mobile-nav"
          className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-border bg-surface p-2 shadow-xl md:hidden"
        >
          <div className="flex flex-col gap-0.5">
            {links.map((link) => {
              const active = isActivePath(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "bg-accent-soft text-accent"
                      : "text-muted hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  {t(link.key)}
                  {badge(link.href)}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
      </div>
    </>
  );
}
