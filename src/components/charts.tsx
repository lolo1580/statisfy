"use client";

import { useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { formatDuration } from "@/lib/format";
import { useI18n } from "@/components/i18n-provider";

const MINUTE_MS = 60_000;

/** Échelle « ronde » pour l'axe vertical (en minutes/heures/jours). */
function axisTicks(maxValue: number): { max: number; ticks: number[] } {
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, 2880, 4320, 7200];
  const minutes = maxValue / MINUTE_MS;
  for (const step of steps) {
    if (step * 4 >= minutes) {
      return {
        max: step * 4 * MINUTE_MS,
        ticks: [0, step, step * 2, step * 3, step * 4].map((m) => m * MINUTE_MS),
      };
    }
  }
  const step = Math.ceil(minutes / 4 / 1440) * 1440;
  return {
    max: step * 4 * MINUTE_MS,
    ticks: [0, step, step * 2, step * 3, step * 4].map((m) => m * MINUTE_MS),
  };
}

/** Durée compacte pour l'axe : « 30 min », « 1 h », « 1.5 h ». */
function compactDuration(ms: number): string {
  if (ms <= 0) return "0";
  const minutes = ms / MINUTE_MS;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} h` : `${hours.toFixed(1)} h`;
}

/**
 * Graphique en aire : grille, axe vertical (durées), libellés d'axe X et
 * infobulle au survol (réticule + point). SVG redimensionnable.
 */
export function AreaChart({
  points,
  height = 200,
}: {
  points: { label: string; value: number; title?: string }[];
  height?: number;
}) {
  const { t } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const gradientId = `area-${useId().replace(/:/g, "")}`;

  if (points.length === 0) {
    return <div className="text-sm text-muted">{t("chart.noData")}</div>;
  }

  const GUTTER = 44;
  const n = points.length;
  const W = 1000;
  const H = 100;
  const step = n > 1 ? W / (n - 1) : W;
  const { max, ticks } = axisTicks(Math.max(...points.map((p) => p.value), 1));
  const coords = points.map((p, i) => {
    const x = i * step;
    const y = H - (p.value / max) * H;
    return [x, y] as const;
  });
  const line = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  const labelIndexes = (() => {
    const count = Math.min(5, n);
    if (count <= 1) return [0];
    const out: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const idx = Math.round((i * (n - 1)) / (count - 1));
      if (!out.includes(idx)) out.push(idx);
    }
    return out;
  })();

  const hovered = hover != null ? points[hover] : null;
  const hoverX = hover != null ? ((hover * step) / W) * 100 : 0;
  const hoverY = hover != null ? (coords[hover][1] / H) * 100 : 0;

  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (n - 1)));
  };

  return (
    <div className="select-none">
      <div className="flex" style={{ gap: 8 }}>
        <div
          className="flex flex-col justify-between text-right text-[10px] leading-none text-muted"
          style={{ height, width: GUTTER - 8 }}
        >
          {ticks
            .slice()
            .reverse()
            .map((tick) => (
              <span key={tick}>{compactDuration(tick)}</span>
            ))}
        </div>
        <div
          ref={plotRef}
          className="relative flex-1"
          style={{ height }}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            style={{ height: "100%", width: "100%" }}
            role="img"
            aria-label={t("chart.evolution")}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {ticks.map((tick) => {
              const y = H - (tick / max) * H;
              return (
                <line
                  key={tick}
                  x1={0}
                  x2={W}
                  y1={y}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  opacity={tick === 0 ? 0.9 : 0.45}
                />
              );
            })}
            <path d={area} fill={`url(#${gradientId})`} />
            <path
              d={line}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>

          {hover != null && hovered ? (
            <>
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-accent/40"
                style={{ left: `${hoverX}%` }}
              />
              <div
                className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-background"
                style={{ left: `${hoverX}%`, top: `${hoverY}%` }}
              />
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-center shadow-lg"
                style={{ left: `${Math.min(95, Math.max(5, hoverX))}%`, top: 0 }}
              >
                <div className="whitespace-nowrap text-[11px] font-medium">
                  {hovered.title ?? hovered.label}
                </div>
                <div className="whitespace-nowrap text-[11px] text-accent">
                  {formatDuration(hovered.value)}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
      <div className="relative mt-2 h-3" style={{ marginLeft: GUTTER }}>
        {labelIndexes.map((idx) => (
          <span
            key={idx}
            className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-muted"
            style={{ left: `${((idx * step) / W) * 100}%` }}
          >
            {points[idx].label}
          </span>
        ))}
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
