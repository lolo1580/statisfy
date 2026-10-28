"use client";

import {
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { formatDuration } from "@/lib/format";
import { useI18n } from "@/components/i18n-provider";
import { axisTicks, compactDuration, smoothLine } from "./shared";

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
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / rect.width),
    );
    setHover(Math.round(ratio * (n - 1)));
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      setHover(null);
      return;
    }
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    event.preventDefault();
    setHover((current) => {
      if (event.key === "Home") return 0;
      if (event.key === "End") return n - 1;
      const base = current ?? 0;
      return event.key === "ArrowLeft"
        ? Math.max(0, base - 1)
        : Math.min(n - 1, base + 1);
    });
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
          className="relative flex-1 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{ height }}
          tabIndex={0}
          role="group"
          aria-label={t("compare.overlay")}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setHover(null)}
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
                <stop
                  offset="0%"
                  stopColor="var(--accent)"
                  stopOpacity="0.28"
                />
                <stop
                  offset="100%"
                  stopColor="var(--accent)"
                  stopOpacity="0.02"
                />
              </linearGradient>
              <linearGradient id={gradientBId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--violet)"
                  stopOpacity="0.24"
                />
                <stop
                  offset="100%"
                  stopColor="var(--violet)"
                  stopOpacity="0.02"
                />
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
                style={{
                  left: `${Math.min(92, Math.max(8, hoverX))}%`,
                  top: 0,
                }}
              >
                <div className="whitespace-nowrap text-[11px] font-medium">
                  {hovered.label}
                </div>
                <div className="mt-1 space-y-0.5 text-[11px]">
                  <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                    <span className="text-muted">{labelA}</span>
                    <span className="text-accent">
                      {formatDuration(hovered.a, locale)}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                    <span className="h-2 w-2 rounded-full bg-violet" />
                    <span className="text-muted">{labelB}</span>
                    <span className="text-violet">
                      {formatDuration(hovered.b, locale)}
                    </span>
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
      <span className="sr-only" aria-live="polite">
        {hovered
          ? `${hovered.label} : ${labelA} ${formatDuration(hovered.a, locale)}, ${labelB} ${formatDuration(hovered.b, locale)}`
          : ""}
      </span>
    </div>
  );
}
