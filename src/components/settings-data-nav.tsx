"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import {
  SETTINGS_DATA_SECTIONS,
  type SettingsDataSection,
} from "@/lib/settings-data";

/** Onglets internes de la page « Données personnelles ». */
export function SettingsDataNav({ current }: { current: SettingsDataSection }) {
  const { t } = useI18n();

  return (
    <nav
      aria-label={t("settings.nav.data")}
      className="flex flex-wrap gap-1 border-b border-border pb-3"
    >
      {SETTINGS_DATA_SECTIONS.map((section) => {
        const active = section === current;
        return (
          <Link
            key={section}
            href={`/settings/data?section=${section}`}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {t(`settings.dataTab.${section}`)}
          </Link>
        );
      })}
    </nav>
  );
}
