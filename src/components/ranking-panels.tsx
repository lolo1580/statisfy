"use client";

import { useState } from "react";
import Link from "next/link";
import { Cover, EmptyState } from "@/components/ui";
import { RankBars } from "@/components/charts";
import { useI18n } from "@/components/i18n-provider";
import { formatDuration, formatNumber } from "@/lib/format";

/** Métrique d'un classement : nombre d'écoutes ou temps d'écoute. */
type Metric = "plays" | "time";

type Ranked = { plays: number; msPlayed: number };

function byMetric<T extends Ranked>(metric: Metric) {
  return (a: T, b: T) =>
    metric === "plays" ? b.plays - a.plays : b.msPlayed - a.msPlayed;
}

function MetricSwitch({
  metric,
  onChange,
}: {
  metric: Metric;
  onChange: (metric: Metric) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-border bg-surface-2 p-0.5 text-[11px]">
      {(["plays", "time"] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={metric === value}
          className={`rounded-md px-2 py-0.5 font-medium transition-colors ${
            metric === value
              ? "bg-accent text-[#04140d]"
              : "text-muted hover:text-foreground"
          }`}
        >
          {value === "plays" ? t("dash.metricPlays") : t("dash.metricTime")}
        </button>
      ))}
    </div>
  );
}

function PanelHeader({
  title,
  subtitle,
  metric,
  onChange,
}: {
  title: string;
  subtitle?: string;
  metric: Metric;
  onChange: (metric: Metric) => void;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
        ) : null}
      </div>
      <MetricSwitch metric={metric} onChange={onChange} />
    </div>
  );
}

/** Classement de titres avec bascule écoutes / temps. */
export function TopTracksPanel({
  title,
  items,
  query,
}: {
  title: string;
  items: Array<{
    id: string;
    name: string;
    artistName: string;
    imageUrl: string | null;
    plays: number;
    msPlayed: number;
  }>;
  query: string;
}) {
  const { locale, t } = useI18n();
  const [metric, setMetric] = useState<Metric>("time");
  const sorted = [...items].sort(byMetric(metric));

  return (
    <div>
      <PanelHeader title={title} metric={metric} onChange={setMetric} />
      {sorted.length === 0 ? (
        <EmptyState>{t("dash.noTracks")}</EmptyState>
      ) : (
        <ol className="space-y-3">
          {sorted.map((track, index) => (
            <li key={track.id}>
              <Link
                href={`/track/${track.id}${query ? `?${query}` : ""}`}
                className="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-surface-2"
              >
                <span className="w-4 text-sm text-muted">{index + 1}</span>
                <Cover src={track.imageUrl} alt={track.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{track.name}</p>
                  <p className="truncate text-xs text-muted">
                    {track.artistName}
                  </p>
                </div>
                <span className="text-xs text-muted">
                  {metric === "plays"
                    ? `${formatNumber(track.plays, locale)}×`
                    : formatDuration(track.msPlayed)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Classement d'artistes avec bascule écoutes / temps. */
export function TopArtistsPanel({
  title,
  items,
  query,
}: {
  title: string;
  items: Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    genres: string[];
    plays: number;
    msPlayed: number;
  }>;
  query: string;
}) {
  const { locale, t } = useI18n();
  const [metric, setMetric] = useState<Metric>("time");
  const sorted = [...items].sort(byMetric(metric));

  return (
    <div>
      <PanelHeader title={title} metric={metric} onChange={setMetric} />
      {sorted.length === 0 ? (
        <EmptyState>{t("dash.noArtists")}</EmptyState>
      ) : (
        <ol className="space-y-3">
          {sorted.map((artist, index) => (
            <li key={artist.id}>
              <Link
                href={`/artist/${artist.id}${query ? `?${query}` : ""}`}
                className="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-surface-2"
              >
                <span className="w-4 text-sm text-muted">{index + 1}</span>
                <Cover
                  src={artist.imageUrl}
                  alt={artist.name}
                  size={40}
                  rounded="rounded-full"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{artist.name}</p>
                  {artist.genres.length > 0 ? (
                    <p className="truncate text-xs text-muted">
                      {artist.genres.slice(0, 2).join(", ")}
                    </p>
                  ) : null}
                </div>
                <span className="text-xs text-muted">
                  {metric === "plays"
                    ? `${formatNumber(artist.plays, locale)}×`
                    : formatDuration(artist.msPlayed)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Classement de genres avec bascule écoutes / temps. */
export function TopGenresPanel({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: Array<{ genre: string; plays: number; msPlayed: number }>;
}) {
  const { locale, t } = useI18n();
  const [metric, setMetric] = useState<Metric>("time");
  const sorted = [...items].sort(byMetric(metric));

  return (
    <div>
      <PanelHeader
        title={title}
        subtitle={subtitle}
        metric={metric}
        onChange={setMetric}
      />
      {sorted.length === 0 ? (
        <EmptyState>{t("dash.genresUnavailable")}</EmptyState>
      ) : (
        <RankBars
          items={sorted.map((genre) => ({
            label: genre.genre,
            value: metric === "plays" ? genre.plays : genre.msPlayed,
            display:
              metric === "plays"
                ? formatNumber(genre.plays, locale)
                : formatDuration(genre.msPlayed),
          }))}
        />
      )}
    </div>
  );
}
