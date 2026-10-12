import { NextResponse, type NextRequest } from "next/server";
import { getOptionalAdmin } from "@/lib/auth/dal";
import { hasValidSyncToken } from "@/lib/auth/sync-token";
import { syncMinIntervalMs } from "@/lib/env";
import { syncAllDue } from "@/lib/sync/engine";

export const dynamic = "force-dynamic";

/**
 * Déclenche la synchronisation de toutes les sources dues.
 * Authentification : header `Authorization: Bearer <SYNC_TOKEN>`
 * ou session administrateur (le jeton en query string n'est plus accepté).
 *
 * Exemple de cron :
 *   curl -X POST -H "Authorization: Bearer $SYNC_TOKEN" https://.../api/sync
 */
async function handle(request: NextRequest) {
  const admin = await getOptionalAdmin();
  const authorized =
    hasValidSyncToken(request.headers.get("authorization")) || admin !== null;

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
