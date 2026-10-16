import { getCurrentUser } from "@/lib/auth/dal";
import {
  getTopAlbums,
  getTopArtists,
  getTopTracks,
  type StatsRange,
} from "@/lib/stats";
import { RangeTabs } from "@/components/range-tabs";
import { parseRange } from "@/lib/range";
import { Card } from "@/components/ui";
import {
  TopAlbumsPanel,
  TopArtistsPanel,
  TopTracksPanel,
} from "@/components/ranking-panels";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function TopPage({ searchParams }: PageProps<"/top">) {
  const user = await getCurrentUser();
  const { t } = await getI18n();
  const params = await searchParams;
  const parsed = parseRange(
    typeof params.range === "string" ? params.range : undefined,
    user.timezone,
  );
  const filters: StatsRange = {
    days: parsed.days,
    from: parsed.from,
    to: parsed.to,
  };
  const query = `range=${parsed.key}`;

  const [
    tracksByPlays,
    tracksByTime,
    artistsByPlays,
    artistsByTime,
    albumsByPlays,
    albumsByTime,
  ] = await Promise.all([
    getTopTracks(user.id, filters, 25),
    getTopTracks(user.id, filters, 25, "time"),
    getTopArtists(user.id, filters, 25),
    getTopArtists(user.id, filters, 25, "time"),
    getTopAlbums(user.id, filters, 20),
    getTopAlbums(user.id, filters, 20, "time"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("top.title")}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <RangeTabs basePath="/top" current={parsed.key} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 3xl:grid-cols-3">
        <Card>
          <TopTracksPanel
            title={t("top.topTracks")}
            itemsByPlays={tracksByPlays}
            itemsByTime={tracksByTime}
            query={query}
            showAlbum
          />
        </Card>

        <div className="space-y-6 3xl:contents 3xl:space-y-0">
          <Card>
            <TopArtistsPanel
              title={t("top.topArtists")}
              itemsByPlays={artistsByPlays}
              itemsByTime={artistsByTime}
              query={query}
              genresCount={3}
            />
          </Card>

          <Card>
            <TopAlbumsPanel
              title={t("top.topAlbums")}
              itemsByPlays={albumsByPlays}
              itemsByTime={albumsByTime}
              query={query}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
