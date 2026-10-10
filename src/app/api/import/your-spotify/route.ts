import { NextResponse, type NextRequest } from "next/server";
import { getOptionalUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { syncToken } from "@/lib/env";
import {
  buildYourSpotifyData,
  mapYourSpotifyData,
} from "@/lib/sources/your-spotify";
import { runPlaysIngest } from "@/lib/sync/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Import d'un dump *Your Spotify* envoyé en POST.
 *
 * Authentification : `Authorization: Bearer <SYNC_TOKEN>` (ou session admin).
 * Corps : l'archive `.zip` du dump (les 4 collections `infos`, `tracks`,
 * `albums`, `artists` en `.bson`).
 *
 * Exemple depuis le serveur Your Spotify :
 *   curl -X POST -H "Authorization: Bearer $SYNC_TOKEN" \
 *     --data-binary @ys-dump.zip \
 *     https://mon-domaine/api/import/your-spotify
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("token") ??
    "";

  const admin = await getOptionalUser();
  const authorized =
    (syncToken.length > 0 && provided === syncToken) || Boolean(admin?.isAdmin);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = url.searchParams.get("email");
  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : ((await prisma.user.findFirst({
        where: { isAdmin: true },
        orderBy: { createdAt: "asc" },
      })) ??
      (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } })));
  if (!user) {
    return NextResponse.json({ error: "No target user" }, { status: 400 });
  }

  const buffer = new Uint8Array(await request.arrayBuffer());
  if (buffer.length === 0) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
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
