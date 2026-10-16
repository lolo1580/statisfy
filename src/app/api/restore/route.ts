import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { getOptionalAdmin } from "@/lib/auth/dal";
import { hasValidSyncToken } from "@/lib/auth/sync-token";
import { restoreDatabase, runBackup } from "@/lib/backup";
import { readBodyLimited } from "@/lib/http-body";

export const dynamic = "force-dynamic";

const MAX_BYTES = 128 * 1024 * 1024;

/**
 * Restaure une sauvegarde PostgreSQL (`.dump`) : l'état actuel est **remplacé**
 * (les objets sont supprimés puis recréés, dans une transaction unique).
 *
 * Réservé aux administrateurs (session) ou à `Bearer <SYNC_TOKEN>`. Un dump de
 * sécurité de l'état courant est créé avant l'opération.
 */
export async function POST(request: NextRequest) {
  const admin = await getOptionalAdmin();
  const authorized =
    admin !== null || hasValidSyncToken(request.headers.get("authorization"));

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  // Lecture bornée en streaming : ne charge jamais plus de MAX_BYTES, même si
  // l'en-tête `Content-Length` est absent (transfert chunked) ou mensonger.
  const limited = await readBodyLimited(request, MAX_BYTES);
  if (!limited) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const body = Buffer.from(limited);
  if (body.length === 0) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

  const file = path.join(os.tmpdir(), `statisfy-restore-${Date.now()}.dump`);
  try {
    fs.writeFileSync(/*turbopackIgnore: true*/ file, body, { mode: 0o600 });
    // Sauvegarde de sécurité de l'état actuel avant d'écraser (best-effort).
    await runBackup().catch(() => undefined);
    await restoreDatabase(file);
    return NextResponse.json({ ok: true });
  } catch {
    // Ne pas exposer le message brut (chemins internes, binaire pg_restore…).
    return NextResponse.json(
      { ok: false, error: "Restore failed" },
      { status: 500 },
    );
  } finally {
    fs.rmSync(/*turbopackIgnore: true*/ file, { force: true });
  }
}
