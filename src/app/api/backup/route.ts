import { NextResponse, type NextRequest } from "next/server";
import { getOptionalUser } from "@/lib/auth/dal";
import { syncToken } from "@/lib/env";
import { runBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

/**
 * Crée une sauvegarde de la base. Authentification : `Bearer <SYNC_TOKEN>`
 * ou session administrateur.
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runBackup();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Backup failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  return handle(request);
}

export async function GET(request: NextRequest) {
  return handle(request);
}
