"use client";

import { useI18n } from "@/components/i18n-provider";
import { themes, THEME_COOKIE, type Theme } from "@/lib/theme";

/** Applique le thème immédiatement, sans attendre un aller-retour serveur. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") {
    // Sans attribut, la media query `prefers-color-scheme` reprend la main.
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", theme);
  }
}

/**
 * Sélecteur de thème (système / clair / sombre). Le choix est mémorisé dans un
 * cookie : le serveur le relit au prochain chargement, évitant tout flash.
 */
export function ThemeSwitcher({ current }: { current: Theme }) {
  const { t } = useI18n();

  function change(next: Theme) {
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    applyTheme(next);
  }

  return (
    <select
      aria-label={t("theme.label")}
      value={current}
      onChange={(event) => change(event.target.value as Theme)}
      className="rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm text-muted outline-none transition-colors focus:border-accent"
    >
      {themes.map((theme) => (
        <option key={theme} value={theme}>
          {t(`theme.${theme}`)}
        </option>
      ))}
    </select>
  );
}
