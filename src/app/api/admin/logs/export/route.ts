import { NextResponse, type NextRequest } from "next/server";
import { getOptionalAdmin } from "@/lib/auth/dal";
import { hasValidSyncToken } from "@/lib/auth/sync-token";
import { prisma } from "@/lib/db";
import { csvCell } from "@/lib/csv";
import { logWhere, parseLogFilters } from "@/lib/logs-query";
import { takeToken } from "@/lib/rate-limit-store";

export const dynamic = "force-dynamic";

const BATCH = 1000;

/** Convertit le champ `meta` (JSON stocké en texte) en objet, sinon brut. */
function parseMeta(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Export du journal d'événements en CSV ou JSON (`?format=csv|json`), en
 * respectant les filtres `level`, `source` et `q`.
 *
 * Réservé aux administrateurs (session) ou à `Bearer <SYNC_TOKEN>`. Pagination
 * par curseur + `ReadableStream` : le journal n'est jamais chargé entièrement
 * en mémoire.
 */
export async function GET(request: NextRequest) {
  const admin = await getOptionalAdmin();
  const authorized =
    admin !== null || hasValidSyncToken(request.headers.get("authorization"));
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (admin && !takeToken(`log-export:${admin.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const search = request.nextUrl.searchParams;
  const format = search.get("format") === "json" ? "json" : "csv";
  const filters = parseLogFilters({
    level: search.get("level") ?? undefined,
    source: search.get("source") ?? undefined,
    q: search.get("q") ?? undefined,
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
  });
  const where = logWhere(filters, admin?.timezone ?? "UTC");

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            format === "csv"
              ? "created_at,level,source,user_email,ip,message,meta\n"
              : "[\n",
          ),
        );

        let cursor: string | undefined;
        let first = true;
        for (;;) {
          const logs = await prisma.logEntry.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: BATCH,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            include: { user: { select: { email: true } } },
          });
          if (logs.length === 0) break;

          let chunk = "";
          for (const log of logs) {
            if (format === "csv") {
              chunk += `${[
                log.createdAt.toISOString(),
                log.level,
                log.source,
                log.user?.email ?? "",
                log.ip ?? "",
                log.message,
                log.meta ?? "",
              ]
                .map(csvCell)
                .join(",")}\n`;
            } else {
              const row = {
                id: log.id,
                createdAt: log.createdAt.toISOString(),
                level: log.level,
                source: log.source,
                message: log.message,
                meta: log.meta ? parseMeta(log.meta) : null,
                ip: log.ip,
                userEmail: log.user?.email ?? null,
              };
              chunk += `${first ? "" : ",\n"}${JSON.stringify(row)}`;
              first = false;
            }
          }
          controller.enqueue(encoder.encode(chunk));

          if (logs.length < BATCH) break;
          cursor = logs[logs.length - 1].id;
        }

        if (format === "json") controller.enqueue(encoder.encode("\n]\n"));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "Content-Type":
        format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="statisfy-logs-${stamp}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
