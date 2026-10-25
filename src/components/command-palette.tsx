"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";

type Item = {
  key: string;
  label: string;
  href: string;
  icon: string;
};

/**
 * Palette de commandes (`⌘K` / `Ctrl+K`) : navigation rapide et recherche
 * dans la bibliothèque. Aucun raccourci global n'est intercepté hors `⌘K`.
 */
export function CommandPalette({ isAdmin = false }: { isAdmin?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const openPalette = useCallback(() => {
    setQuery("");
    setActive(0);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() =>
      document.getElementById("command-trigger")?.focus(),
    );
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) close();
        else openPalette();
      } else if (event.key === "Escape" && open) {
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, open, openPalette]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const navigation: Item[] = [
      { key: "dashboard", label: t("nav.overview"), href: "/dashboard", icon: "📊" },
      { key: "compare", label: t("nav.compare"), href: "/compare", icon: "⚖️" },
      { key: "wrapped", label: t("nav.recap"), href: "/wrapped", icon: "✨" },
      { key: "history", label: t("nav.history"), href: "/history", icon: "🕘" },
      { key: "settings", label: t("nav.settings"), href: "/settings", icon: "⚙️" },
    ];
    if (isAdmin) {
      navigation.push({
        key: "admin",
        label: t("nav.admin"),
        href: "/admin",
        icon: "🛡️",
      });
    }
    navigation.push({
      key: "docs",
      label: t("apiDocs.title"),
      href: "/api-docs",
      icon: "🔌",
    });

    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? navigation.filter(
          (item) =>
            item.label.toLowerCase().includes(needle) ||
            item.href.toLowerCase().includes(needle),
        )
      : navigation;

    if (needle) {
      return [
        ...filtered,
        {
          key: "search",
          label: t("palette.searchFor", { query: query.trim() }),
          href: `/search?q=${encodeURIComponent(query.trim())}`,
          icon: "🔎",
        },
      ];
    }
    return filtered;
  }, [isAdmin, query, t]);

  const select = (item: Item) => {
    close();
    router.push(item.href);
  };

  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <button
        id="command-trigger"
        type="button"
        onClick={openPalette}
        aria-haspopup="dialog"
        title="Ctrl+K / ⌘K"
        className="flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-muted transition-colors hover:border-accent/40 hover:text-foreground"
      >
        <span className="flex min-w-0 items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
            className="shrink-0"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className="truncate">{t("palette.trigger")}</span>
        </span>
        <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted sm:inline">
          Ctrl K
        </kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t("palette.placeholder")}
          onClick={close}
        >
          <div
            ref={panelRef}
            onKeyDown={onPanelKeyDown}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-border p-3">
              <input
                ref={inputRef}
                role="combobox"
                aria-expanded="true"
                aria-controls="command-list"
                aria-autocomplete="list"
                aria-activedescendant={
                  items[active] ? `command-item-${items[active].key}` : undefined
                }
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActive((index) =>
                      Math.max(0, Math.min(items.length - 1, index + 1)),
                    );
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActive((index) => Math.max(0, index - 1));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    const item = items[active];
                    if (item) select(item);
                  }
                }}
                placeholder={t("palette.placeholder")}
                aria-label={t("palette.placeholder")}
                className="w-full bg-transparent px-2 py-1 text-base outline-none placeholder:text-muted/70"
              />
            </div>

            <div
              id="command-list"
              role="listbox"
              className="max-h-[50vh] overflow-y-auto p-2"
            >
              {items.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted">
                  {t("palette.noResults")}
                </p>
              ) : (
                items.map((item, index) => (
                  <button
                    key={item.key}
                    id={`command-item-${item.key}`}
                    role="option"
                    aria-selected={index === active}
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => select(item)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      index === active
                        ? "bg-accent-soft text-accent"
                        : "text-muted hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    <span aria-hidden>{item.icon}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {item.label}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted">
              <span>{t("palette.navigate")}</span>
              <span>{t("palette.open")}</span>
              <span>{t("palette.close")}</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
