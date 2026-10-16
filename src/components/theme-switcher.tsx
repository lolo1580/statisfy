"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { themes, THEME_COOKIE, type Theme } from "@/lib/theme";

/** Applique le thème et le mémorise (cookie). Exécuté hors rendu (onClick). */
function persistTheme(theme: Theme) {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
  const root = document.documentElement;
  if (theme === "system") {
    // Sans attribut, la media query `prefers-color-scheme` reprend la main.
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

/** Icônes : écran (système), soleil (clair), lune (sombre). */
function ThemeIcon({ theme }: { theme: Theme }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (theme === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    );
  }
  if (theme === "dark") {
    return (
      <svg {...common}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

/**
 * Sélecteur de thème (système / clair / sombre) sous forme de boutons-icônes.
 * Le choix est mémorisé dans un cookie : le serveur le relit au prochain
 * chargement, évitant tout flash.
 */
export function ThemeSwitcher({ current }: { current: Theme }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Theme>(current);

  function change(next: Theme) {
    if (next === selected) return;
    persistTheme(next);
    setSelected(next);
  }

  return (
    <div
      role="group"
      aria-label={t("theme.label")}
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5"
    >
      {themes.map((theme) => {
        const active = theme === selected;
        const label = t(`theme.${theme}`);
        return (
          <button
            key={theme}
            type="button"
            onClick={() => change(theme)}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={`rounded-md p-1.5 transition-colors ${
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            <ThemeIcon theme={theme} />
          </button>
        );
      })}
    </div>
  );
}
