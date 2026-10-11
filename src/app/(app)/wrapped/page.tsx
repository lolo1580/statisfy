import { getCurrentUser } from "@/lib/auth/dal";
import { getPlayingYears } from "@/lib/stats";
import { monthNames, parseWrappedPeriod } from "@/lib/period";
import { WrappedContent } from "@/components/wrapped-content";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

const selectClass =
  "rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent";

export default async function WrappedPage({
  searchParams,
}: PageProps<"/wrapped">) {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const sp = await searchParams;
  const period = parseWrappedPeriod(
    typeof sp.year === "string" ? sp.year : undefined,
    typeof sp.month === "string" ? sp.month : undefined,
  );

  const years = await getPlayingYears(user.id);
  const monthsLong = monthNames(locale);
  const yearOptions = [
    ...new Set([...years, period.year, new Date().getUTCFullYear()]),
  ]
    .filter((year) => year >= 2000)
    .sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("recap.title")}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <form action="/wrapped" className="flex flex-wrap items-end gap-2">
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
          <a
            href={`/api/wrapped/image?year=${period.year}${period.month ? `&month=${period.month}` : ""}`}
            download={`statisfy-${period.key}.png`}
            className="rounded-lg border border-border px-4 py-1.5 text-sm transition-colors hover:border-accent/40 hover:text-accent"
          >
            {t("recap.download")}
          </a>
          <a
            href={`/api/wrapped/image?year=${period.year}${period.month ? `&month=${period.month}` : ""}&format=story`}
            download={`statisfy-story-${period.key}.png`}
            className="rounded-lg border border-border px-4 py-1.5 text-sm transition-colors hover:border-accent/40 hover:text-accent"
          >
            {t("recap.downloadStory")}
          </a>
        </div>
      </div>

      <WrappedContent
        userId={user.id}
        timezone={user.timezone}
        period={period}
        interactive
      />
    </div>
  );
}
