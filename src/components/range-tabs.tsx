"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";

export const RANGES = [
  { value: "7", key: "range.7" },
  { value: "30", key: "range.30" },
  { value: "90", key: "range.90" },
  { value: "365", key: "range.365" },
  { value: "all", key: "range.all" },
];

export const SOURCES = [
  { value: "all", key: "source.all" },
  { value: "spotify", key: "source.spotify" },
  { value: "import", key: "source.import" },
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
  source,
}: {
  basePath: string;
  current: string;
  source?: string | null;
}) {
  const { t } = useI18n();
  return (
    <div className="inline-flex rounded-xl border border-border bg-surface/70 p-1">
      {RANGES.map((range) => {
        const active = range.value === current;
        return (
          <Link
            key={range.value}
            href={buildHref(basePath, { range: range.value, source })}
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

export function SourceFilter({
  basePath,
  current,
  rangeKey,
}: {
  basePath: string;
  current: string | null;
  rangeKey: string;
}) {
  const { t } = useI18n();
  return (
    <div className="inline-flex rounded-xl border border-border bg-surface/70 p-1">
      {SOURCES.map((source) => {
        const value = source.value === "all" ? null : source.value;
        const active = (current ?? "all") === source.value;
        return (
          <Link
            key={source.value}
            href={buildHref(basePath, { range: rangeKey, source: value })}
            prefetch={false}
            className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-violet text-white"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t(source.key)}
          </Link>
        );
      })}
    </div>
  );
}


