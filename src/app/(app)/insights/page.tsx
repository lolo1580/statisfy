import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import {
  getArtistTrends,
  getDiscoveredArtists,
  getRediscoveries,
} from "@/lib/stats";
import { Badge, Card, Cover, EmptyState, SectionTitle } from "@/components/ui";
import { formatDate, formatDuration, formatNumber } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();

  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );

  const [trends, rediscoveries, discoveredThisMonth] = await Promise.all([
    getArtistTrends(user.id, { days: 30 }, 8),
    getRediscoveries(user.id, { recentDays: 90, minPlays: 5, limit: 8 }),
    getDiscoveredArtists(user.id, { days: null, from: monthStart }, 8),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {t("insights.title")}
      </h1>

      <div className="grid gap-6 3xl:grid-cols-2 3xl:items-start">
      <Card>
        <SectionTitle
          title={t("insights.obsessions")}
          subtitle={t("insights.obsessionsSubtitle")}
        />
        {trends.rising.length === 0 ? (
          <EmptyState>{t("insights.noObsessions")}</EmptyState>
        ) : (
          <ol className="space-y-1">
            {trends.rising.map((artist) => (
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{artist.name}</p>
                    <p className="truncate text-xs text-muted">
                      {formatNumber(artist.previous, locale)} →{" "}
                      {formatNumber(artist.current, locale)}
                    </p>
                  </div>
                  <Badge tone="accent">+{formatNumber(artist.delta, locale)}</Badge>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card>
        <SectionTitle
          title={t("insights.rediscoveries")}
          subtitle={t("insights.rediscoveriesSubtitle")}
        />
        {rediscoveries.length === 0 ? (
          <EmptyState>{t("insights.noRediscoveries")}</EmptyState>
        ) : (
          <ol className="space-y-1">
            {rediscoveries.map((artist) => (
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{artist.name}</p>
                    {artist.lastPlayed ? (
                      <p className="truncate text-xs text-muted">
                        {t("insights.lastPlayed", {
                          date: formatDate(artist.lastPlayed, user.timezone, locale),
                        })}
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
      </div>

      {discoveredThisMonth.count > 0 ? (
        <Card>
          <SectionTitle
            title={t("recap.discovered")}
            subtitle={t("insights.obsessionsSubtitle")}
          />
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {discoveredThisMonth.artists.map((artist) => (
              <Link
                key={artist.id}
                href={`/artist/${artist.id}`}
                className="min-w-0 text-center"
              >
                <Cover
                  src={artist.imageUrl}
                  alt={artist.name}
                  size={80}
                  rounded="rounded-full"
                />
                <p className="mt-2 truncate text-xs font-medium">
                  {artist.name}
                </p>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
