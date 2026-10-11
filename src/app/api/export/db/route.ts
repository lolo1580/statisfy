import fs from "node:fs";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { getOptionalUser } from "@/lib/auth/dal";
import { syncToken } from "@/lib/env";
import { createTemporarySnapshot } from "@/lib/backup";

export const dynamic = "force-dynamic";

/**
 * Télécharge un instantané complet de la base SQLite (`.db`).
 *
 * Réservé aux administrateurs (session) ou à `Bearer <SYNC_TOKEN>` : la base
 * contient les données de tous les comptes et les identifiants chiffrés.
 */
export async function GET(request: NextRequest) {
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const admin = await getOptionalUser();
  const authorized =
    Boolean(admin?.isAdmin) || (syncToken.length > 0 && provided === syncToken);

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await createTemporarySnapshot();
  const nodeStream = fs.createReadStream(snapshot.file);
  const cleanup = () => snapshot.dispose();
  nodeStream.once("close", cleanup);
  nodeStream.once("error", cleanup);

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>, {
    headers: {
      "Content-Type": "application/vnd.sqlite3",
      "Content-Disposition": `attachment; filename="statisfy-${stamp}.db"`,
      "Cache-Control": "no-store",
    },
  });
}
