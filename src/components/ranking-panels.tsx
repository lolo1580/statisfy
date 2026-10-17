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

export type TrackItem = {
  id: string;
  name: string;
  artistName: string;
  albumName?: string | null;
  imageUrl: string | null;
  plays: number;
  msPlayed: number;
};

export type ArtistItem = {
  id: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
  plays: number;
  msPlayed: number;
};

export type GenreItem = { genre: string; plays: number; msPlayed: number };

/** Choisit le classement pré-trié par le serveur selon la métrique. */
function pickRanking<T>(metric: Metric, byPlays: T[], byTime: T[]): T[] {
  return metric === "plays" ? byPlays : byTime;
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
              ? "bg-accent text-on-accent"
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

/** Affiche la métrique choisie (écoutes ou temps). */
function metricValue(metric: Metric, item: Ranked, locale: string): string {
  return metric === "plays"
    ? `${formatNumber(item.plays, locale)}×`
    : formatDuration(item.msPlayed, locale);
}

/** Classement de titres avec bascule écoutes / temps. */
export function TopTracksPanel({
  title,
  itemsByPlays,
  itemsByTime,
  query,
  showAlbum = false,
  empty,
}: {
  title: string;
  /** Top titres classés par écoutes (calculé côté serveur). */
  itemsByPlays: TrackItem[];
  /** Top titres classés par temps d'écoute (calculé côté serveur). */
  itemsByTime: TrackItem[];
  query: string;
  showAlbum?: boolean;
  empty?: string;
}) {
  const { locale, t } = useI18n();
  const [metric, setMetric] = useState<Metric>("time");
  const items = pickRanking(metric, itemsByPlays, itemsByTime);

  return (
    <div>
      <PanelHeader title={title} metric={metric} onChange={setMetric} />
      {items.length === 0 ? (
        <EmptyState>{empty ?? t("generic.noData")}</EmptyState>
      ) : (
        <ol className="space-y-3">
          {items.map((track, index) => (
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
                    {showAlbum && track.albumName ? ` — ${track.albumName}` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted">
                  {metricValue(metric, track, locale)}
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
  itemsByPlays,
  itemsByTime,
  query,
  genresCount = 2,
  empty,
}: {
  title: string;
  itemsByPlays: ArtistItem[];
  itemsByTime: ArtistItem[];
  query: string;
  genresCount?: number;
  empty?: string;
}) {
  const { locale, t } = useI18n();
  const [metric, setMetric] = useState<Metric>("time");
  const items = pickRanking(metric, itemsByPlays, itemsByTime);

  return (
    <div>
      <PanelHeader title={title} metric={metric} onChange={setMetric} />
      {items.length === 0 ? (
        <EmptyState>{empty ?? t("generic.noData")}</EmptyState>
      ) : (
        <ol className="space-y-3">
          {items.map((artist, index) => (
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
                      {artist.genres.slice(0, genresCount).join(", ")}
                    </p>
                  ) : null}
                </div>
                <span className="text-xs text-muted">
                  {metricValue(metric, artist, locale)}
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
  itemsByPlays,
  itemsByTime,
  empty,
}: {
  title: string;
  subtitle?: string;
  itemsByPlays: GenreItem[];
  itemsByTime: GenreItem[];
  empty?: string;
}) {
  const { locale, t } = useI18n();
  const [metric, setMetric] = useState<Metric>("time");
  const items = pickRanking(metric, itemsByPlays, itemsByTime);

  return (
    <div>
      <PanelHeader
        title={title}
        subtitle={subtitle}
        metric={metric}
        onChange={setMetric}
      />
      {items.length === 0 ? (
        <EmptyState>{empty ?? t("generic.noData")}</EmptyState>
      ) : (
        <RankBars
          items={items.map((genre) => ({
            label: genre.genre,
            value: metric === "plays" ? genre.plays : genre.msPlayed,
            display:
              metric === "plays"
                ? formatNumber(genre.plays, locale)
                : formatDuration(genre.msPlayed, locale),
          }))}
        />
      )}
    </div>
  );
}
