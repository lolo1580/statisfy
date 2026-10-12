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
 * Chemin SVG lissé : interpolation cubique monotone (Fritsch–Carlson) qui
 * passe par chaque point sans dépasser au-dessus ni en dessous.
 */
function smoothLine(coords: readonly (readonly [number, number])[]): string {
  const n = coords.length;
  if (n === 0) return "";
  const start = `M${coords[0][0].toFixed(2)},${coords[0][1].toFixed(2)}`;
  if (n === 1) return start;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const delta = coords[i + 1][0] - coords[i][0];
    dx.push(delta);
    slope.push(delta === 0 ? 0 : (coords[i + 1][1] - coords[i][1]) / delta);
  }

  // Tangentes initiales, puis lissage des points intérieurs.
  const m: number[] = new Array(n);
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i += 1) {
    m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }

  // Limite la pente pour garantir la monotonie (pas de rebond).
  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }

  let path = start;
  for (let i = 0; i < n - 1; i += 1) {
    const [x0, y0] = coords[i];
    const [x1, y1] = coords[i + 1];
    const c1x = x0 + dx[i] / 3;
    const c1y = y0 + (m[i] * dx[i]) / 3;
    const c2x = x1 - dx[i] / 3;
    const c2y = y1 - (m[i + 1] * dx[i]) / 3;
    path += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }
  return path;
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
  const { locale, t } = useI18n();
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
  const single = n === 1;
  const coords = points.map((p, i) => {
    const x = i * step;
    const y = H - (p.value / max) * H;
    return [x, y] as const;
  });
  // Un point unique : bande plate sur toute la largeur (sinon l'aire se referme
  // en triangle trompeur — ex. « Écoute quotidienne » sur un seul jour).
  const line = single
    ? `M0,${coords[0][1].toFixed(2)} L${W},${coords[0][1].toFixed(2)}`
    : smoothLine(coords);
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
  const hoverX = hover != null ? (single ? 50 : ((hover * step) / W) * 100) : 0;
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
                  {formatDuration(hovered.value, locale)}
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
            style={{ left: n === 1 ? "50%" : `${((idx * step) / W) * 100}%` }}
          >
            {points[idx].label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Graphique de comparaison : deux séries superposées (aires + lignes), axe
 * vertical des durées et infobulle au survol affichant les deux valeurs.
 */
export function CompareChart({
  points,
  labelA,
  labelB,
  height = 220,
}: {
  points: { label: string; a: number; b: number }[];
  labelA: string;
  labelB: string;
  height?: number;
}) {
  const { locale, t } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, "");
  const gradientAId = `cmp-a-${uid}`;
  const gradientBId = `cmp-b-${uid}`;

  if (points.length === 0) {
    return <div className="text-sm text-muted">{t("chart.noData")}</div>;
  }

  const GUTTER = 44;
  const n = points.length;
  const W = 1000;
  const H = 100;
  const step = n > 1 ? W / (n - 1) : W;
  const { max, ticks } = axisTicks(
    Math.max(...points.map((p) => Math.max(p.a, p.b)), 1),
  );
  const coordsA: [number, number][] = points.map((p, i) => [
    i * step,
    H - (p.a / max) * H,
  ]);
  const coordsB: [number, number][] = points.map((p, i) => [
    i * step,
    H - (p.b / max) * H,
  ]);
  const toPath = (coords: [number, number][]) => smoothLine(coords);
  const lineA = toPath(coordsA);
  const lineB = toPath(coordsB);
  const areaA = `${lineA} L${W},${H} L0,${H} Z`;
  const areaB = `${lineB} L${W},${H} L0,${H} Z`;

  const labelIndexes = (() => {
    const count = Math.min(6, n);
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

  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setHover(Math.round(ratio * (n - 1)));
  };

  return (
    <div className="select-none">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          {labelA}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-violet" />
          {labelB}
        </span>
      </div>
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
            aria-label={t("compare.overlay")}
          >
            <defs>
              <linearGradient id={gradientAId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id={gradientBId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--violet)" stopOpacity="0.24" />
                <stop offset="100%" stopColor="var(--violet)" stopOpacity="0.02" />
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
            <path d={areaB} fill={`url(#${gradientBId})`} />
            <path
              d={lineB}
              fill="none"
              stroke="var(--violet)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path d={areaA} fill={`url(#${gradientAId})`} />
            <path
              d={lineA}
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
                className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-violet bg-background"
                style={{
                  left: `${hoverX}%`,
                  top: `${(coordsB[hover][1] / H) * 100}%`,
                }}
              />
              <div
                className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-background"
                style={{
                  left: `${hoverX}%`,
                  top: `${(coordsA[hover][1] / H) * 100}%`,
                }}
              />
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-center shadow-lg"
                style={{ left: `${Math.min(92, Math.max(8, hoverX))}%`, top: 0 }}
              >
                <div className="whitespace-nowrap text-[11px] font-medium">
                  {hovered.label}
                </div>
                <div className="mt-1 space-y-0.5 text-[11px]">
                  <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                    <span className="text-muted">{labelA}</span>
                    <span className="text-accent">{formatDuration(hovered.a, locale)}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                    <span className="h-2 w-2 rounded-full bg-violet" />
                    <span className="text-muted">{labelB}</span>
                    <span className="text-violet">{formatDuration(hovered.b, locale)}</span>
                  </div>
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
            style={{ left: n === 1 ? "50%" : `${((idx * step) / W) * 100}%` }}
          >
            {points[idx].label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Échelle « ronde » pour un axe de comptage (entiers). */
function countTicks(value: number): { max: number; ticks: number[] } {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
  for (const step of steps) {
    if (step * 4 >= value) {
      return { max: step * 4, ticks: [0, step, step * 2, step * 3, step * 4] };
    }
  }
  const step = Math.ceil(value / 4 / 10000) * 10000;
  return { max: step * 4, ticks: [0, step, step * 2, step * 3, step * 4] };
}

/** Indices des libellés à afficher sous les barres. */
function pickLabels(n: number): Set<number> {
  const set = new Set<number>();
  if (n <= 12) {
    for (let i = 0; i < n; i += 1) set.add(i);
    return set;
  }
  const step = Math.ceil(n / 4);
  for (let i = 0; i < n; i += step) set.add(i);
  set.add(n - 1);
  return set;
}

/** Barres verticales (répartition horaire, cumuls mensuels…). */
export function BarsChart({
  bars,
  height = 160,
  variant = "count",
}: {
  bars: { label: string; value: number; title?: string }[];
  height?: number;
  /** `count` : valeurs entières ; `duration` : durées (axe en min/h/j). */
  variant?: "count" | "duration";
}) {
  const { locale, t } = useI18n();
  const [hover, setHover] = useState<number | null>(null);

  if (bars.length === 0) {
    return <div className="text-sm text-muted">{t("chart.noData")}</div>;
  }

  const duration = variant === "duration";
  const GUTTER = duration ? 44 : 36;
  const n = bars.length;
  const maxValue = Math.max(...bars.map((bar) => bar.value), 1);
  const { max, ticks } = duration ? axisTicks(maxValue) : countTicks(maxValue);
  const formatTick = (value: number) =>
    duration ? compactDuration(value) : String(value);
  const labels = pickLabels(n);
  const hovered = hover != null ? bars[hover] : null;
  const hoverLeft = hover != null ? ((hover + 0.5) / n) * 100 : 0;
  const hoverValue = hovered
    ? (hovered.title ??
      (duration ? formatDuration(hovered.value, locale) : String(hovered.value)))
    : "";

  return (
    <div className="select-none">
      <div className="flex" style={{ gap: 8 }}>
        <div
          className="flex flex-col justify-between text-right text-[10px] leading-none text-muted"
          style={{ height, width: GUTTER }}
        >
          {ticks
            .slice()
            .reverse()
            .map((tick) => (
              <span key={tick}>{formatTick(tick)}</span>
            ))}
        </div>
        <div className="relative flex-1" style={{ height }}>
          {ticks.map((tick) => (
            <div
              key={tick}
              className="absolute inset-x-0 border-t border-border"
              style={{ top: `${(1 - tick / max) * 100}%`, opacity: tick === 0 ? 0.9 : 0.45 }}
            />
          ))}
          <div
            className="absolute inset-0 grid items-end gap-1"
            style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
          >
            {bars.map((bar, index) => (
              <div
                key={bar.label}
                className="flex h-full items-end"
                onPointerEnter={() => setHover(index)}
                onPointerLeave={() => setHover(null)}
              >
                <div
                  className="w-full rounded-t bg-gradient-to-t from-accent/30 to-accent transition-opacity"
                  style={{
                    height: `${Math.max((bar.value / max) * 100, 1)}%`,
                    opacity: hover == null || hover === index ? 1 : 0.4,
                  }}
                />
              </div>
            ))}
          </div>
          {hover != null && hovered ? (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-center shadow-lg"
              style={{ left: `${Math.min(94, Math.max(6, hoverLeft))}%`, top: 0 }}
            >
              <div className="whitespace-nowrap text-[11px] font-medium">
                {hovered.label}
              </div>
              <div className="whitespace-nowrap text-[11px] text-accent">
                {hoverValue}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div
        className="mt-2 grid gap-1 text-center text-[10px] text-muted"
        style={{
          marginLeft: GUTTER + 8,
          gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
        }}
      >
        {bars.map((bar, index) => (
          <span key={bar.label} className="truncate">
            {labels.has(index) ? bar.label : ""}
          </span>
        ))}
      </div>
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
