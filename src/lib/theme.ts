/**
 * Préférence de thème (clair / sombre / système).
 *
 * Module sans dépendance serveur : partagé par le layout (lecture du cookie)
 * et par le sélecteur côté client.
 */

export const themes = ["system", "light", "dark"] as const;

export type Theme = (typeof themes)[number];

/** Par défaut on suit le réglage du système. */
export const defaultTheme: Theme = "system";

export const THEME_COOKIE = "theme";

export function isTheme(value: string | undefined | null): value is Theme {
  return !!value && (themes as readonly string[]).includes(value);
}
