"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Cover, EmptyState } from "@/components/ui";
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

/** Affiche la métrique choisie (écoutes ou temps). */
function metricValue(metric: Metric, item: Ranked, locale: string): string {
  return metric === "plays"
    ? `${formatNumber(item.plays, locale)}×`
    : formatDuration(item.msPlayed);
}

/** Classement de titres avec bascule écoutes / temps. */
export function TopTracksPanel({
  title,
  items,
  query,
  showAlbum = false,
  empty,
}: {
  title: string;
  items: Array<{
    id: string;
    name: string;
    artistName: string;
    albumName?: string | null;
    imageUrl: string | null;
    plays: number;
    msPlayed: number;
  }>;
  query: string;
  showAlbum?: boolean;
  empty?: string;
}) {
  const { locale, t } = useI18n();
  const [metric, setMetric] = useState<Metric>("time");
  const sorted = [...items].sort(byMetric(metric));

  return (
    <div>
      <PanelHeader title={title} metric={metric} onChange={setMetric} />
      {sorted.length === 0 ? (
        <EmptyState>{empty ?? t("generic.noData")}</EmptyState>
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
  items,
  query,
  genresCount = 2,
  empty,
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
  genresCount?: number;
  empty?: string;
}) {
  const { locale, t } = useI18n();
  const [metric, setMetric] = useState<Metric>("time");
  const sorted = [...items].sort(byMetric(metric));

  return (
    <div>
      <PanelHeader title={title} metric={metric} onChange={setMetric} />
      {sorted.length === 0 ? (
        <EmptyState>{empty ?? t("generic.noData")}</EmptyState>
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

/** Classement d'albums avec bascule écoutes / temps. */
export function TopAlbumsPanel({
  title,
  items,
  query,
  empty,
}: {
  title: string;
  items: Array<{
    id: string;
    name: string;
    artistId: string;
    artistName: string;
    imageUrl: string | null;
    plays: number;
    msPlayed: number;
  }>;
  query: string;
  empty?: string;
}) {
  const { locale, t } = useI18n();
  const [metric, setMetric] = useState<Metric>("time");
  const sorted = [...items].sort(byMetric(metric));

  return (
    <div>
      <PanelHeader title={title} metric={metric} onChange={setMetric} />
      {sorted.length === 0 ? (
        <EmptyState>{empty ?? t("generic.noData")}</EmptyState>
      ) : (
        <ol className="space-y-3">
          {sorted.map((album, index) => (
            <li key={album.id}>
              <Link
                href={`/artist/${album.artistId}${query ? `?${query}` : ""}`}
                className="flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-surface-2"
              >
                <span className="w-4 text-sm text-muted">{index + 1}</span>
                <Cover src={album.imageUrl} alt={album.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{album.name}</p>
                  <p className="truncate text-xs text-muted">
                    {album.artistName}
                  </p>
                </div>
                <Badge>{metricValue(metric, album, locale)}</Badge>
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
  empty,
}: {
  title: string;
  subtitle?: string;
  items: Array<{ genre: string; plays: number; msPlayed: number }>;
  empty?: string;
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
        <EmptyState>{empty ?? t("generic.noData")}</EmptyState>
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
