import { NextResponse, type NextRequest } from "next/server";
import { resolveImportTarget } from "@/lib/api/import-target";
import { runImport } from "@/lib/sync/engine";
import { enrichMissingDurations } from "@/lib/sources/enrich";
import { recountPlays } from "@/lib/sync/recount";
import { getMinListenRatio } from "@/lib/settings";
import { readBodyLimited } from "@/lib/http-body";
import { takeToken } from "@/lib/rate-limit-store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Taille maximale du corps accepté (archive d'export Spotify). */
const MAX_BODY_BYTES = 256 * 1024 * 1024;

/**
 * Import d'un export de données Spotify (« Extended streaming history »)
 * envoyé en POST.
 *
 * Auth : `Bearer <SYNC_TOKEN>`, HTTP Basic (`email:mot de passe`) ou session
 * admin. Corps : l'archive `.zip` fournie par Spotify, ou un unique fichier
 * `Streaming_History_Audio_*.json`.
 *
 * Exemple depuis le serveur où se trouve l'export :
 *   curl --user 'vous@exemple.com:motdepasse' \
 *     --data-binary @my_spotify_data.zip \
 *     https://mon-domaine/api/import/spotify-history
 */
export async function POST(request: NextRequest) {
  const target = await resolveImportTarget(request);
  if (!target.ok) return target.response;
  const { user } = target;

  if (!takeToken(`import:${user.id}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many imports, try again later." },
      { status: 429 },
    );
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const buffer = await readBodyLimited(request, MAX_BODY_BYTES);
  if (!buffer) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  if (buffer.length === 0) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b; // "PK"
  const name = isZip ? "history.zip" : "history.json";
  const result = await runImport(user.id, [{ name, data: buffer }]);

  if (result.total === 0) {
    return NextResponse.json(
      {
        error:
          "No playable history found. Send the Spotify data export .zip or a Streaming_History_Audio_*.json file.",
        files: result.files,
      },
      { status: 422 },
    );
  }

  // Complète les durées de piste manquantes (l'export n'en fournit pas) puis
  // applique le seuil de comptabilisation aux écoutes importées.
  try {
    await enrichMissingDurations(user.id, { max: 60 });
    await recountPlays(await getMinListenRatio());
  } catch {
    // Enrichissement optionnel : l'import reste valide sans lui.
  }

  return NextResponse.json({
    ok: true,
    user: user.email,
    files: result.files,
    inserted: result.inserted,
    total: result.total,
  });
}
