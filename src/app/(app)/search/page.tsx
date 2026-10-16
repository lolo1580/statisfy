import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { searchLibrary } from "@/lib/stats";
import { Badge, Card, Cover, EmptyState, SectionTitle } from "@/components/ui";
import { formatDuration } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: PageProps<"/search">) {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q.trim() : "";
  const results = query
    ? await searchLibrary(user.id, query, 20)
    : { artists: [], tracks: [] };

  const hasResults =
    results.artists.length > 0 || results.tracks.length > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("search.title")}
      </h1>

      <form action="/search" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          autoFocus
          placeholder={t("search.placeholder")}
          aria-label={t("search.placeholder")}
          className="w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
        >
          {t("search.submit")}
        </button>
      </form>

      {!query ? (
        <EmptyState>{t("search.hint")}</EmptyState>
      ) : !hasResults ? (
        <EmptyState>{t("search.noResults", { query })}</EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <SectionTitle
              title={t("search.artists")}
              subtitle={t("search.resultsCount", {
                count: results.artists.length,
              })}
            />
            {results.artists.length === 0 ? (
              <EmptyState>{t("search.noArtist")}</EmptyState>
            ) : (
              <ul className="space-y-1">
                {results.artists.map((artist) => (
                  <li key={artist.id}>
                    <Link
                      href={`/artist/${artist.id}`}
                      className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-surface-2"
                    >
                      <Cover
                        src={artist.imageUrl}
                        alt={artist.name}
                        size={40}
                        rounded="rounded-full"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {artist.name}
                      </span>
                      <Badge>{formatDuration(artist.msPlayed, locale)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionTitle
              title={t("search.tracks")}
              subtitle={t("search.resultsCount", {
                count: results.tracks.length,
              })}
            />
            {results.tracks.length === 0 ? (
              <EmptyState>{t("search.noTrack")}</EmptyState>
            ) : (
              <ul className="space-y-1">
                {results.tracks.map((track) => (
                  <li key={track.id}>
                    <Link
                      href={`/track/${track.id}`}
                      className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-surface-2"
                    >
                      <Cover src={track.imageUrl} alt={track.name} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {track.name}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {track.artistName}
                          {track.albumName ? ` — ${track.albumName}` : ""}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
