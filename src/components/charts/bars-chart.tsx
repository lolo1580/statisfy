"use client";

import { useState } from "react";
import { formatDuration } from "@/lib/format";
import { useI18n } from "@/components/i18n-provider";
import { axisTicks, compactDuration, countTicks, pickLabels } from "./shared";

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
      (duration
        ? formatDuration(hovered.value, locale)
        : String(hovered.value)))
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
              style={{
                top: `${(1 - tick / max) * 100}%`,
                opacity: tick === 0 ? 0.9 : 0.45,
              }}
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
              style={{
                left: `${Math.min(94, Math.max(6, hoverLeft))}%`,
                top: 0,
              }}
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
