import { NextResponse, type NextRequest } from "next/server";
import { getOptionalUser } from "@/lib/auth/dal";
import { syncMinIntervalMs, syncToken } from "@/lib/env";
import { syncAllDue } from "@/lib/sync/engine";

export const dynamic = "force-dynamic";

/**
 * Déclenche la synchronisation de toutes les sources dues.
 * Authentification : header `Authorization: Bearer <SYNC_TOKEN>`
 * ou paramètre `?token=`, ou session administrateur.
 *
 * Exemple de cron :
 *   curl -X POST -H "Authorization: Bearer $SYNC_TOKEN" https://.../api/sync
 */
async function handle(request: NextRequest) {
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    new URL(request.url).searchParams.get("token") ??
    "";

  const admin = await getOptionalUser();
  const authorized =
    (syncToken.length > 0 && provided === syncToken) || Boolean(admin?.isAdmin);

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
