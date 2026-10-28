"use client";

import { useI18n } from "@/components/i18n-provider";

/** Heatmap type « contribution » : un carré par jour, regroupés par semaine. */
export function Heatmap({ days }: { days: { day: string; plays: number }[] }) {
  const { t } = useI18n();
  if (days.length === 0) {
    return <div className="text-sm text-muted">{t("chart.noData")}</div>;
  }

  const max = Math.max(...days.map((d) => d.plays), 1);
  const first = new Date(`${days[0].day}T00:00:00Z`);
  const firstDow = (first.getUTCDay() + 6) % 7; // lundi = 0

  const weeks: ({ day: string; plays: number } | null)[][] = [];
  let week: ({ day: string; plays: number } | null)[] =
    Array(firstDow).fill(null);
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
      <div className="flex w-max gap-[3px] sm:mx-auto">
        {weeks.map((column, columnIndex) => (
          <div key={columnIndex} className="flex flex-col gap-[3px]">
            {column.map((cell, cellIndex) =>
              cell ? (
                <div
                  key={cellIndex}
                  title={`${cell.day} — ${t("dash.playsCount", { count: cell.plays })}`}
                  className="h-3 w-3 rounded-sm sm:h-3.5 sm:w-3.5"
                  style={{ background: color(cell.plays) }}
                />
              ) : (
                <div key={cellIndex} className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Heatmap 7×24 : intensité des écoutes par **jour de la semaine × heure locale**
 * (lundi = 0). `grid[dow][hour]` contient un nombre d'écoutes.
 */
export function WeekdayHourHeatmap({
  grid,
  max,
}: {
  grid: number[][];
  max: number;
}) {
  const { locale, t } = useI18n();
  if (max <= 0) {
    return <div className="text-sm text-muted">{t("chart.noData")}</div>;
  }

  // 2024-01-01 est un lundi : sert de référence pour des libellés localisés.
  const weekday = (dow: number) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "short",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2024, 0, 1 + dow)));

  const color = (value: number) => {
    if (value <= 0) return "var(--surface-2)";
    const level = Math.min(4, Math.ceil((value / max) * 4));
    const alpha = [0.25, 0.45, 0.7, 1][level - 1] ?? 1;
    return `rgba(25, 209, 138, ${alpha})`;
  };

  return (
    <div className="overflow-x-auto pb-1">
      <div className="w-max sm:mx-auto">
        <div className="mb-1 flex items-center gap-[3px]">
          <span className="w-8 shrink-0" />
          {Array.from({ length: 24 }, (_, hour) => (
            <span
              key={hour}
              className="w-4 shrink-0 text-center text-[9px] text-muted sm:w-6"
            >
              {hour % 6 === 0 ? `${hour}h` : ""}
            </span>
          ))}
        </div>
        <div className="space-y-[3px]">
          {grid.map((row, dow) => (
            <div key={dow} className="flex items-center gap-[3px]">
              <span className="w-8 shrink-0 text-[10px] uppercase text-muted">
                {weekday(dow)}
              </span>
              {row.map((value, hour) => (
                <div
                  key={hour}
                  title={`${weekday(dow)} ${hour}h — ${t("dash.playsCount", { count: value })}`}
                  className="h-4 w-4 shrink-0 rounded-sm sm:h-6 sm:w-6"
                  style={{ background: color(value) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
