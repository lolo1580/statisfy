import { NextResponse, type NextRequest } from "next/server";
import { getOptionalAdmin } from "@/lib/auth/dal";
import { hasValidSyncToken } from "@/lib/auth/sync-token";
import { runBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

/**
 * Crée une sauvegarde de la base. Authentification : `Bearer <SYNC_TOKEN>`
 * ou session administrateur. POST uniquement.
 */
async function handle(request: NextRequest) {
  const admin = await getOptionalAdmin();
  const authorized =
    admin !== null || hasValidSyncToken(request.headers.get("authorization"));

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runBackup();
    return NextResponse.json({ ok: true, ...result });
  } catch {
    // On ne renvoie pas le message brut (chemins internes, etc.).
    return NextResponse.json(
      { ok: false, error: "Backup failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return handle(request);
}
