import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { LOG_LEVELS, LOG_SOURCES } from "@/lib/log";
import { logQueryString, logWhere, parseLogFilters } from "@/lib/logs-query";
import { activeSinkKind } from "@/lib/log-sink";
import { clearLogs } from "@/lib/actions/logs";
import { TestLogSinkButton } from "@/components/admin-forms";
import { ConfirmForm } from "@/components/confirm-form";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { formatDateTime, formatNumber } from "@/lib/format";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const LEVEL_TONE: Record<string, "neutral" | "accent" | "violet" | "danger"> = {
  debug: "neutral",
  info: "accent",
  warn: "violet",
  error: "danger",
};

function asString(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value;
  return Array.isArray(value) ? value[0] : undefined;
}

/** Journal d'événements de l'instance : consultation filtrée + export. */
export default async function AdminLogsPage({
  searchParams,
}: PageProps<"/admin/logs">) {
  const user = await getCurrentUser();
  const { locale, t } = await getI18n();
  const params = await searchParams;

  const filters = parseLogFilters(params);
  const where = logWhere(filters, user.timezone);

  const total = await prisma.logEntry.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requested = Number(asString(params.page));
  const page = Math.min(
    Number.isFinite(requested) && requested >= 1 ? Math.floor(requested) : 1,
    pages,
  );

  const entries = await prisma.logEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { user: { select: { email: true, name: true } } },
  });

  const exportCsv = `/api/admin/logs/export${logQueryString(filters, {
    format: "csv",
  })}`;
  const exportJson = `/api/admin/logs/export${logQueryString(filters, {
    format: "json",
  })}`;
  const sinkKind = activeSinkKind();

  const selectClass =
    "rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent";
  const linkClass =
    "rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent/40 hover:text-accent";

  return (
    <Card>
      <SectionTitle
        title={t("admin.logsTitle")}
        subtitle={t("admin.logsSubtitle")}
        action={
          <div className="flex flex-wrap gap-2">
            <a href={exportCsv} className={linkClass}>
              {t("admin.logExportCsv")}
            </a>
            <a href={exportJson} className={linkClass}>
              {t("admin.logExportJson")}
            </a>
            <TestLogSinkButton />
            <ConfirmForm
              action={clearLogs}
              fields={{}}
              message={t("admin.logClearConfirm")}
              className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/10"
            >
              {t("admin.logClear")}
            </ConfirmForm>
          </div>
        }
      />

      {sinkKind ? (
        <p className="-mt-2 mb-4 text-xs text-muted">
          {t("admin.logSinkActive", { sink: sinkKind })}
        </p>
      ) : null}

      <form
        method="get"
        className="mb-4 flex flex-wrap items-end gap-2 border-b border-border pb-4"
      >
        <div>
          <label htmlFor="log-level" className="mb-1 block text-xs text-muted">
            {t("admin.logFilterLevel")}
          </label>
          <select
            id="log-level"
            name="level"
            defaultValue={filters.level ?? ""}
            className={selectClass}
          >
            <option value="">{t("admin.logFilterAll")}</option>
            {LOG_LEVELS.map((level) => (
              <option key={level} value={level}>
                {t(`admin.logLevel.${level}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="log-source" className="mb-1 block text-xs text-muted">
            {t("admin.logFilterSource")}
          </label>
          <select
            id="log-source"
            name="source"
            defaultValue={filters.source ?? ""}
            className={selectClass}
          >
            <option value="">{t("admin.logFilterAll")}</option>
            {LOG_SOURCES.map((source) => (
              <option key={source} value={source}>
                {t(`admin.logSource.${source}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[180px] flex-1">
          <label htmlFor="log-q" className="mb-1 block text-xs text-muted">
            {t("admin.logFilterSearch")}
          </label>
          <input
            id="log-q"
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder={t("admin.logFilterSearchPlaceholder")}
            className={`w-full ${selectClass}`}
          />
        </div>
        <div>
          <label htmlFor="log-from" className="mb-1 block text-xs text-muted">
            {t("admin.logFilterFrom")}
          </label>
          <input
            id="log-from"
            type="date"
            name="from"
            defaultValue={filters.from ?? ""}
            className={selectClass}
          />
        </div>
        <div>
          <label htmlFor="log-to" className="mb-1 block text-xs text-muted">
            {t("admin.logFilterTo")}
          </label>
          <input
            id="log-to"
            type="date"
            name="to"
            defaultValue={filters.to ?? ""}
            className={selectClass}
          />
        </div>
        <button
          type="submit"
          className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:border-accent/40 hover:text-accent"
        >
          {t("admin.logFilterApply")}
        </button>
        <Link href="/admin/logs" className={linkClass}>
          {t("admin.logFilterReset")}
        </Link>
      </form>

      {entries.length === 0 ? (
        <EmptyState>{t("admin.logEmpty")}</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="py-2 pr-3 font-medium">
                  {t("admin.logDate")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {t("admin.logFilterLevel")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {t("admin.logFilterSource")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {t("admin.logMessage")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {t("admin.logUser")}
                </th>
                <th className="py-2 font-medium">{t("admin.logIp")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="whitespace-nowrap py-2 pr-3 text-xs text-muted">
                    {formatDateTime(entry.createdAt, user.timezone, locale)}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge tone={LEVEL_TONE[entry.level] ?? "neutral"}>
                      {t(`admin.logLevel.${entry.level}`)}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-muted">
                    {t(`admin.logSource.${entry.source}`)}
                  </td>
                  <td className="max-w-[420px] py-2 pr-3">
                    <span>{entry.message}</span>
                    {entry.meta ? (
                      <span
                        title={entry.meta}
                        className="ml-1 block truncate text-xs text-muted"
                      >
                        {entry.meta}
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-xs text-muted">
                    {entry.user?.email ?? "—"}
                  </td>
                  <td className="whitespace-nowrap py-2 text-xs text-muted">
                    {entry.ip ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-xs text-muted">
          {t("admin.logShowing", {
            count: formatNumber(total, locale),
            page,
            pages,
          })}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={`/admin/logs${logQueryString(filters, { page: page - 1 })}`}
              className={linkClass}
            >
              {t("admin.logPrev")}
            </Link>
          ) : null}
          {page < pages ? (
            <Link
              href={`/admin/logs${logQueryString(filters, { page: page + 1 })}`}
              className={linkClass}
            >
              {t("admin.logNext")}
            </Link>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
