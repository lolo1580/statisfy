"use client";

import { useRouter } from "next/navigation";
import { locales, LOCALE_LABELS, type Locale } from "@/i18n/config";

export function LocaleSwitcher({ current }: { current: Locale }) {
  const router = useRouter();

  function change(next: string) {
    document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <select
      aria-label="Language"
      value={current}
      onChange={(event) => change(event.target.value)}
      className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm text-muted outline-none transition-colors focus:border-accent"
    >
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {LOCALE_LABELS[locale]}
        </option>
      ))}
    </select>
  );
}
