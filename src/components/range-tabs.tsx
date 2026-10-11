"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";

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
  return (
    <div className="inline-flex flex-wrap rounded-xl border border-border bg-surface/70 p-1">
      {RANGES.map((range) => {
        const active = range.value === current;
        return (
          <Link
            key={range.value}
            href={buildHref(basePath, { range: range.value })}
            prefetch={false}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-accent text-[#04140d]"
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
