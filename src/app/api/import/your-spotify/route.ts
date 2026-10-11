import { NextResponse, type NextRequest } from "next/server";
import { resolveImportTarget } from "@/lib/api/import-target";
import {
  buildYourSpotifyData,
  mapYourSpotifyData,
} from "@/lib/sources/your-spotify";
import { runPlaysIngest } from "@/lib/sync/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Taille maximale du corps accepté (dump Your Spotify). */
const MAX_BODY_BYTES = 256 * 1024 * 1024;

/**
 * Import d'un dump *Your Spotify* envoyé en POST.
 *
 * Auth : `Bearer <SYNC_TOKEN>`, HTTP Basic (`email:mot de passe`) ou session
 * admin. Corps : l'archive `.zip` du dump (collections `infos`, `tracks`,
 * `albums`, `artists` en `.bson`).
 */
export async function POST(request: NextRequest) {
  const target = await resolveImportTarget(request);
  if (!target.ok) return target.response;
  const { user } = target;

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const buffer = new Uint8Array(await request.arrayBuffer());
  if (buffer.length === 0) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }
  if (buffer.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b; // "PK"
  const name = isZip ? "dump.zip" : "dump.bson";
  const { data, counts } = buildYourSpotifyData([{ name, data: buffer }]);

  if (!counts.infos) {
    return NextResponse.json(
      {
        error:
          "No `infos` collection found. Send a .zip of the dump (infos/tracks/albums/artists .bson).",
        counts,
      },
      { status: 422 },
    );
  }

  const { plays } = mapYourSpotifyData(data);
  const result = await runPlaysIngest(user.id, plays);

  return NextResponse.json({
    ok: true,
    user: user.email,
    counts,
    inserted: result.inserted,
    total: result.total,
  });
}
