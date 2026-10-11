import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { getTrends, type StatsRange, type TrendRow } from "@/lib/stats";
import { Badge, Card, Cover, EmptyState, SectionTitle } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

const WINDOWS = [7, 30, 90, 365] as const;

const asString = (value: unknown) =>
  typeof value === "string" ? value : undefined;

function TrendList({
  rows,
  empty,
  locale,
  href,
  rounded = "rounded-lg",
}: {
  rows: TrendRow[];
  empty: string;
  locale: string;
  href?: (id: string) => string;
  rounded?: string;
}) {
  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <ol className="space-y-1">
      {rows.map((row) => {
        const content = (
          <>
            <Cover src={row.imageUrl} alt={row.name} size={40} rounded={rounded} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{row.name}</p>
              {row.subtitle ? (
                <p className="truncate text-xs text-muted">{row.subtitle}</p>
              ) : null}
            </div>
            <Badge tone={row.delta >= 0 ? "accent" : "danger"}>
              {row.delta >= 0 ? "+" : ""}
              {formatNumber(row.delta, locale)}
            </Badge>
          </>
        );
        return (
          <li key={row.id}>
            {href ? (
              <Link
                href={href(row.id)}
                className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-surface-2"
              >
                {content}
              </Link>
            ) : (
              <div className="flex items-center gap-3 p-1.5">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default async function TrendsPage({
  searchParams,
}: PageProps<"/trends">) {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const sp = await searchParams;

  const raw = Number(asString(sp.window));
  const windowDays = (WINDOWS as readonly number[]).includes(raw) ? raw : 30;
  const filters: StatsRange = { days: windowDays };

  const [artists, tracks, albums] = await Promise.all([
    getTrends(user.id, "artist", filters, 10),
    getTrends(user.id, "track", filters, 10),
    getTrends(user.id, "album", filters, 10),
  ]);

  const sections = [
    {
      title: t("top.topArtists"),
      data: artists,
      href: (id: string) => `/artist/${id}`,
      rounded: "rounded-full",
    },
    {
      title: t("top.topTracks"),
      data: tracks,
      href: (id: string) => `/track/${id}`,
      rounded: "rounded-lg",
    },
    {
      title: t("top.topAlbums"),
      data: albums,
      href: undefined as ((id: string) => string) | undefined,
      rounded: "rounded-lg",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("trends.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t("dash.trendsSubtitle", { days: windowDays })}
          </p>
        </div>
        <div className="inline-flex flex-wrap rounded-xl border border-border bg-surface/70 p-1">
          {WINDOWS.map((days) => {
            const active = days === windowDays;
            return (
              <Link
                key={days}
                href={`/trends?window=${days}`}
                prefetch={false}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-accent text-[#04140d]"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {t(`trends.w${days}`)}
              </Link>
            );
          })}
        </div>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">
            {section.title}
          </h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <SectionTitle title={t("dash.rising")} />
              <TrendList
                rows={section.data.rising}
                empty={t("trends.noRising")}
                locale={locale}
                href={section.href}
                rounded={section.rounded}
              />
            </Card>
            <Card>
              <SectionTitle title={t("dash.falling")} />
              <TrendList
                rows={section.data.falling}
                empty={t("trends.noFalling")}
                locale={locale}
                href={section.href}
                rounded={section.rounded}
              />
            </Card>
          </div>
          {!section.data.hasPrevious ? (
            <p className="text-xs text-muted">{t("trends.noPrevious")}</p>
          ) : null}
        </section>
      ))}
    </div>
  );
}
