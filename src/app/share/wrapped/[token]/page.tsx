import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import { getSharedUserId } from "@/lib/wrapped-share";
import { prisma } from "@/lib/db";
import { getOverview, getPlayingYears } from "@/lib/stats";
import {
  formatPeriodLabel,
  monthNames,
  parseWrappedPeriod,
} from "@/lib/period";
import { WrappedContent } from "@/components/wrapped-content";
import { getI18n } from "@/i18n/server";
import { formatDuration, formatNumber } from "@/lib/format";
import { requestOrigin } from "@/lib/sources/spotify-state";
import { appName } from "@/lib/env";

export const dynamic = "force-dynamic";

// Lien non répertorié : on demande aux moteurs de ne pas l'indexer.
function privateMetadata(): Metadata {
  return { robots: { index: false, follow: false } };
}

/** Propriétaire du partage, mémoïsé pour la requête (metadata + page). */
const getSharedOwner = cache(async (token: string) => {
  const userId = await getSharedUserId(token);
  if (!userId) return null;
  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, timezone: true },
  });
  return owner ? { userId, ...owner } : null;
});

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/share/wrapped/[token]">): Promise<Metadata> {
  const { token } = await params;
  const shared = await getSharedOwner(token);
  if (!shared) return privateMetadata();
  const { userId, name } = shared;

  const sp = await searchParams;
  const period = parseWrappedPeriod(
    typeof sp.year === "string" ? sp.year : undefined,
    typeof sp.month === "string" ? sp.month : undefined,
  );
  const { locale, t } = await getI18n();
  const periodLabel = formatPeriodLabel(period, locale, t("recap.yearLabel"));
  const overview = await getOverview(userId, {
    days: null,
    from: period.from,
    to: period.to,
  });
  const description = t("share.ogDescription", {
    name,
    period: periodLabel,
    plays: formatNumber(overview.totalPlays, locale),
    time: formatDuration(overview.totalMs, locale),
  });

  const origin = (await requestOrigin()) ?? "";
  const imageParams = new URLSearchParams({
    token,
    year: String(period.year),
    locale,
  });
  if (period.month) imageParams.set("month", String(period.month));
  const imagePath = `/api/wrapped/og?${imageParams.toString()}`;
  const imageUrl = origin ? `${origin}${imagePath}` : imagePath;

  const pageParams = new URLSearchParams({ year: String(period.year) });
  if (period.month) pageParams.set("month", String(period.month));
  const pageUrl = origin
    ? `${origin}/share/wrapped/${token}?${pageParams.toString()}`
    : undefined;
  const title = `${name} — ${periodLabel}`;

  return {
    metadataBase: origin ? new URL(origin) : undefined,
    title,
    description,
    ...privateMetadata(),
    openGraph: {
      type: "website",
      title,
      description,
      siteName: appName,
      ...(pageUrl ? { url: pageUrl } : {}),
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

const selectClass =
  "rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent";

export default async function SharedWrappedPage({
  params,
  searchParams,
}: PageProps<"/share/wrapped/[token]">) {
  const { token } = await params;
  const shared = await getSharedOwner(token);
  if (!shared) notFound();
  const { userId, name, timezone } = shared;

  const { locale, t } = await getI18n();
  const sp = await searchParams;
  const period = parseWrappedPeriod(
    typeof sp.year === "string" ? sp.year : undefined,
    typeof sp.month === "string" ? sp.month : undefined,
  );

  const years = await getPlayingYears(userId);
  const monthsLong = monthNames(locale);
  const yearOptions = [
    ...new Set([...years, period.year, new Date().getUTCFullYear()]),
  ]
    .filter((year) => year >= 2000)
    .sort((a, b) => b - a);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">
            {t("share.kicker")}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
        </div>
        <form
          action={`/share/wrapped/${token}`}
          className="flex flex-wrap items-end gap-2"
        >
          <select
            name="year"
            defaultValue={period.year}
            aria-label={t("recap.periodYear")}
            className={selectClass}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <select
            name="month"
            defaultValue={period.month ?? 0}
            aria-label={t("recap.periodMonth")}
            className={selectClass}
          >
            <option value={0}>{t("recap.wholeYear")}</option>
            {monthsLong.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
          >
            {t("recap.view")}
          </button>
        </form>
      </div>

      <WrappedContent
        userId={userId}
        timezone={timezone}
        period={period}
        interactive={false}
      />

      <footer className="mt-12 border-t border-border pt-4 text-center text-xs text-muted">
        <Link href="/" className="transition-colors hover:text-accent">
          {t("share.footer", { name: appName })}
        </Link>
      </footer>
    </main>
  );
}
