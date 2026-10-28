import fs from "node:fs";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { getOptionalAdmin } from "@/lib/auth/dal";
import { hasValidSyncToken } from "@/lib/auth/sync-token";
import { createTemporarySnapshot, type Snapshot } from "@/lib/backup";

export const dynamic = "force-dynamic";

/**
 * Télécharge un dump PostgreSQL complet de la base (`.dump`, format `pg_dump`
 * personnalisé, restaurable avec `pg_restore`).
 *
 * Réservé aux administrateurs (session) ou à `Bearer <SYNC_TOKEN>` : la base
 * contient les données de tous les comptes et les identifiants chiffrés.
 */
export async function GET(request: NextRequest) {
  const admin = await getOptionalAdmin();
  const authorized =
    admin !== null || hasValidSyncToken(request.headers.get("authorization"));

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let snapshot: Snapshot;
  try {
    snapshot = await createTemporarySnapshot();
  } catch {
    // Ne pas exposer le message brut (chemins internes, binaire pg_dump…).
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
  const nodeStream = fs.createReadStream(snapshot.file);
  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    clearTimeout(guard);
    snapshot.dispose();
  };
  // Filet de sécurité : libère le dump temporaire même si le flux n'émet jamais
  // `close` (réponse non consommée / client abandonnant sans annulation).
  const guard = setTimeout(cleanup, 10 * 60 * 1000);
  guard.unref?.();
  nodeStream.once("close", cleanup);
  nodeStream.once("error", cleanup);

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(
    Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>,
    {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="statisfy-${stamp}.dump"`,
        "Cache-Control": "no-store",
      },
    },
  );
}
