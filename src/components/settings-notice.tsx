"use client";

import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";

/**
 * Bandeau d'information affiché après une redirection (`?ok=` / `?error=`),
 * par exemple au retour du flux OAuth Spotify. Rendu dans le layout des
 * Réglages pour rester visible quel que soit l'onglet actif.
 *
 * Seules les valeurs connues sont affichées : le paramètre d'URL n'est jamais
 * reflété tel quel (évite l'affichage d'un message arbitraire / usurpation d'UI).
 */
const NOTICE_VALUES = new Set([
  "spotify",
  "spotify_config",
  "spotify_denied",
  "spotify_state",
  "spotify_exchange",
  "spotify_not_approved",
]);

export function SettingsNotice() {
  const params = useSearchParams();
  const { t } = useI18n();

  const ok = params.get("ok");
  const error = params.get("error");
  const value = ok ?? error;
  if (!value || !NOTICE_VALUES.has(value)) return null;

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        ok
          ? "border-accent/30 bg-accent-soft text-accent"
          : "border-danger/30 bg-danger/10 text-danger"
      }`}
    >
      {t(`notice.${value}`)}
    </div>
  );
}
