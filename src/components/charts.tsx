"use client";

import { formatDuration } from "@/lib/format";
import { useI18n } from "@/components/i18n-provider";

/**
 * Graphique en aire (SVG pur, rendu côté serveur, sans JavaScript client).
 * Les infobulles utilisent l'élément natif <title>.
 */
export function AreaChart({
  points,
  height = 160,
}: {
  points: { label: string; value: number }[];
  height?: number;
}) {
  const { t } = useI18n();
  if (points.length === 0) {
    return <div className="text-sm text-muted">{t("chart.noData")}</div>;
  }
  const max = Math.max(...points.map((p) => p.value), 1);
  const width = 100;
  const chartHeight = 100;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points.map((p, i) => {
    const x = i * step;
    const y = chartHeight - (p.value / max) * chartHeight;
    return [x, y] as const;
  });
  const line = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${width},${chartHeight} L0,${chartHeight} Z`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${chartHeight}`}
        preserveAspectRatio="none"
        style={{ height, width: "100%" }}
        role="img"
        aria-label={t("chart.evolution")}
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#areaFill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/** Barres verticales (répartition horaire, etc.). */
export function BarsChart({
  bars,
}: {
  bars: { label: string; value: number; title?: string }[];
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div className="flex h-40 items-end gap-1">
      {bars.map((bar) => (
        <div
          key={bar.label}
          className="group relative flex h-full flex-1 flex-col justify-end"
          title={bar.title ?? `${bar.label} — ${bar.value}`}
        >
          <div
            className="rounded-t bg-gradient-to-t from-accent/30 to-accent transition-all group-hover:from-accent/50"
            style={{ height: `${Math.max((bar.value / max) * 100, 1)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

/** Barres horizontales classées (genres). */
export function RankBars({
  items,
}: {
  items: { label: string; value: number; display?: string }[];
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="truncate capitalize">{item.label}</span>
            <span className="text-muted">{item.display ?? item.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet to-accent"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function formatDurationShort(ms: number): string {
  return formatDuration(ms);
}

/** Heatmap type « contribution » : un carré par jour, regroupés par semaine. */
export function Heatmap({
  days,
}: {
  days: { day: string; plays: number }[];
}) {
  const { t } = useI18n();
  if (days.length === 0) {
    return <div className="text-sm text-muted">{t("chart.noData")}</div>;
  }

  const max = Math.max(...days.map((d) => d.plays), 1);
  const first = new Date(`${days[0].day}T00:00:00Z`);
  const firstDow = (first.getUTCDay() + 6) % 7; // lundi = 0

  const weeks: ({ day: string; plays: number } | null)[][] = [];
  let week: ({ day: string; plays: number } | null)[] = Array(firstDow).fill(
    null,
  );
  for (const day of days) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const color = (value: number) => {
    if (value <= 0) return "var(--surface-2)";
    const level = Math.min(4, Math.ceil((value / max) * 4));
    const alpha = [0.25, 0.45, 0.7, 1][level - 1] ?? 1;
    return `rgba(25, 209, 138, ${alpha})`;
  };

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-[3px]">
        {weeks.map((column, columnIndex) => (
          <div key={columnIndex} className="flex flex-col gap-[3px]">
            {column.map((cell, cellIndex) =>
              cell ? (
                <div
                  key={cellIndex}
                  title={`${cell.day} — ${t("dash.playsCount", { count: cell.plays })}`}
                  className="h-3 w-3 rounded-sm"
                  style={{ background: color(cell.plays) }}
                />
              ) : (
                <div key={cellIndex} className="h-3 w-3" />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
