import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSharedUserId } from "@/lib/wrapped-share";
import { prisma } from "@/lib/db";
import { getPlayingYears } from "@/lib/stats";
import { monthNames, parseWrappedPeriod } from "@/lib/period";
import { WrappedContent } from "@/components/wrapped-content";
import { getI18n } from "@/i18n/server";
import { appName } from "@/lib/env";

export const dynamic = "force-dynamic";

// Lien non répertorié : on demande aux moteurs de ne pas l'indexer.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const selectClass =
  "rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent";

export default async function SharedWrappedPage({
  params,
  searchParams,
}: PageProps<"/share/wrapped/[token]">) {
  const { token } = await params;
  const userId = await getSharedUserId(token);
  if (!userId) notFound();

  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, timezone: true },
  });
  if (!owner) notFound();

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
          <h1 className="text-2xl font-semibold tracking-tight">
            {owner.name}
          </h1>
        </div>
        <form
          action={`/share/wrapped/${token}`}
          className="flex flex-wrap items-end gap-2"
        >
          <select name="year" defaultValue={period.year} className={selectClass}>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <select
            name="month"
            defaultValue={period.month ?? 0}
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
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-[#140d04] transition-opacity hover:opacity-90"
          >
            {t("recap.view")}
          </button>
        </form>
      </div>

      <WrappedContent
        userId={userId}
        timezone={owner.timezone}
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
