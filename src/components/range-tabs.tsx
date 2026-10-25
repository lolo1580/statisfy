"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { RANGE_COOKIE, RANGE_COOKIE_MAX_AGE } from "@/lib/range";

export const RANGES = [
  { value: "today", key: "range.today" },
  { value: "week", key: "range.week" },
  { value: "month", key: "range.month" },
  { value: "year", key: "range.year" },
  { value: "all", key: "range.all" },
];

function buildHref(
  basePath: string,
  params: Record<string, string | null | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function RangeTabs({
  basePath,
  current,
}: {
  basePath: string;
  current: string;
}) {
  const { t } = useI18n();

  // Mémorise la période courante pour les prochaines pages (même sans ?range).
  useEffect(() => {
    document.cookie = `${RANGE_COOKIE}=${encodeURIComponent(
      current,
    )}; path=/; max-age=${RANGE_COOKIE_MAX_AGE}; samesite=lax`;
  }, [current]);

  return (
    <div className="inline-flex flex-wrap rounded-xl border border-border bg-surface/70 p-1">
      {RANGES.map((range) => {
        const active = range.value === current;
        return (
          <Link
            key={range.value}
            href={buildHref(basePath, { range: range.value })}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
              active
                ? "bg-accent text-on-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t(range.key)}
          </Link>
        );
      })}
    </div>
  );
}
