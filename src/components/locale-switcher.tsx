"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { locales, LOCALE_LABELS, type Locale } from "@/i18n/config";

/** Mémorise la langue (cookie) ; le serveur la relit à la requête suivante. */
function persistLocale(next: Locale) {
  document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Sélecteur de langue sous forme de boutons « EN » / « FR », dans le même
 * esprit que le sélecteur de thème.
 */
export function LocaleSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  const { t } = useI18n();
  const [selected, setSelected] = useState<Locale>(current);

  function change(next: Locale) {
    if (next === selected) return;
    persistLocale(next);
    setSelected(next);
    router.refresh();
  }

  return (
    <div
      role="group"
      aria-label={t("locale.label")}
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5"
    >
      {locales.map((locale) => {
        const active = locale === selected;
        const label = LOCALE_LABELS[locale];
        return (
          <button
            key={locale}
            type="button"
            onClick={() => change(locale)}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={`rounded-md px-2 py-1 text-xs font-semibold uppercase transition-colors ${
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {locale}
          </button>
        );
      })}
    </div>
  );
}
