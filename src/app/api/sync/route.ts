import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { getOptionalUser } from "@/lib/auth/dal";
import { syncMinIntervalMs, syncToken } from "@/lib/env";
import { syncAllDue } from "@/lib/sync/engine";

export const dynamic = "force-dynamic";

/** Comparaison de chaînes en temps constant. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Déclenche la synchronisation de toutes les sources dues.
 * Authentification : header `Authorization: Bearer <SYNC_TOKEN>`
 * ou session administrateur (le jeton en query string n'est plus accepté).
 *
 * Exemple de cron :
 *   curl -X POST -H "Authorization: Bearer $SYNC_TOKEN" https://.../api/sync
 */
async function handle(request: NextRequest) {
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

  const admin = await getOptionalUser();
  const tokenOk = syncToken.length > 0 && safeEqual(provided, syncToken);
  const authorized = tokenOk || Boolean(admin?.isAdmin);

  if (!authorized) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const results = await syncAllDue(syncMinIntervalMs);
  return NextResponse.json({
    synced: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}
