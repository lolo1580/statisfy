import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { getTopAlbums, getTopArtists, getTopTracks, type StatsRange } from "@/lib/stats";
import { RangeTabs, SourceFilter } from "@/components/range-tabs";
import { parseRange, parseSource } from "@/lib/range";
import { Badge, Card, Cover, EmptyState, SectionTitle } from "@/components/ui";
import { formatDuration } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

function href(
  kind: "artist" | "track",
  id: string,
  rangeKey: string,
  source: string | null,
): string {
  const params = new URLSearchParams();
  if (rangeKey) params.set("range", rangeKey);
  if (source) params.set("source", source);
  const query = params.toString();
  return `/${kind}/${id}${query ? `?${query}` : ""}`;
}

export default async function TopPage({ searchParams }: PageProps<"/top">) {
  const user = await getCurrentUser();
  const { t } = await getI18n();
  const params = await searchParams;
  const parsed = parseRange(
    typeof params.range === "string" ? params.range : undefined,
    user.timezone,
  );
  const source = parseSource(
    typeof params.source === "string" ? params.source : undefined,
  );
  const filters: StatsRange = {
    days: parsed.days,
    from: parsed.from,
    to: parsed.to,
    source,
  };

  const [tracks, artists, albums] = await Promise.all([
    getTopTracks(user.id, filters, 25),
    getTopArtists(user.id, filters, 25),
    getTopAlbums(user.id, filters, 20),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("top.title")}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <RangeTabs basePath="/top" current={parsed.key} source={source} />
          <SourceFilter basePath="/top" current={source} rangeKey={parsed.key} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 3xl:grid-cols-3">
        <Card>
          <SectionTitle title={t("top.topTracks")} />
          {tracks.length === 0 ? (
            <EmptyState>{t("generic.noData")}</EmptyState>
          ) : (
            <ol className="space-y-1">
              {tracks.map((track, index) => (
                <li key={track.id}>
                  <Link
                    href={href("track", track.id, parsed.key, source)}
                    className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-surface-2"
                  >
                    <span className="w-5 text-sm text-muted">{index + 1}</span>
                    <Cover src={track.imageUrl} alt={track.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{track.name}</p>
                      <p className="truncate text-xs text-muted">
                        {track.artistName}
                        {track.albumName ? ` — ${track.albumName}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted">
                      {formatDuration(track.msPlayed)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <div className="space-y-6 3xl:contents 3xl:space-y-0">
          <Card>
            <SectionTitle title={t("top.topArtists")} />
            {artists.length === 0 ? (
              <EmptyState>{t("generic.noData")}</EmptyState>
            ) : (
              <ol className="space-y-1">
                {artists.map((artist, index) => (
                  <li key={artist.id}>
                    <Link
                      href={href("artist", artist.id, parsed.key, source)}
                      className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-surface-2"
                    >
                      <span className="w-5 text-sm text-muted">{index + 1}</span>
                      <Cover
                        src={artist.imageUrl}
                        alt={artist.name}
                        size={40}
                        rounded="rounded-full"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {artist.name}
                        </p>
                        {artist.genres.length > 0 ? (
                          <p className="truncate text-xs text-muted">
                            {artist.genres.slice(0, 3).join(", ")}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-xs text-muted">
                        {formatDuration(artist.msPlayed)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card>
            <SectionTitle title={t("top.topAlbums")} />
            {albums.length === 0 ? (
              <EmptyState>{t("generic.noData")}</EmptyState>
            ) : (
              <ol className="space-y-1">
                {albums.map((album, index) => (
                  <li key={album.id}>
                    <Link
                      href={href("artist", album.artistId, parsed.key, source)}
                      className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-surface-2"
                    >
                      <span className="w-5 text-sm text-muted">{index + 1}</span>
                      <Cover src={album.imageUrl} alt={album.name} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {album.name}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {album.artistName}
                        </p>
                      </div>
                      <Badge>{formatDuration(album.msPlayed)}</Badge>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
