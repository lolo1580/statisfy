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
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / rect.width),
    );
    setHover(Math.round(ratio * (n - 1)));
  };

  // Navigation clavier : le graphique est focusable et les flèches déplacent
  // le curseur, avec annonce de la valeur via la région `aria-live`.
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
          aria-label={t("chart.evolution")}
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
            aria-label={t("chart.evolution")}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--accent)"
                  stopOpacity="0.35"
                />
                <stop
                  offset="100%"
                  stopColor="var(--accent)"
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
                style={{
                  left: `${Math.min(95, Math.max(5, hoverX))}%`,
                  top: 0,
                }}
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
      <span className="sr-only" aria-live="polite">
        {hovered
          ? `${hovered.title ?? hovered.label} : ${formatDuration(hovered.value, locale)}`
          : ""}
      </span>
    </div>
  );
}
