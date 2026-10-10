import { NextResponse, type NextRequest } from "next/server";
import { resolveImportTarget } from "@/lib/api/import-target";
import { runImport } from "@/lib/sync/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  const buffer = new Uint8Array(await request.arrayBuffer());
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

  return NextResponse.json({
    ok: true,
    user: user.email,
    files: result.files,
    inserted: result.inserted,
    total: result.total,
  });
}
