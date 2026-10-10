import { NextResponse, type NextRequest } from "next/server";
import { getOptionalUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { syncToken } from "@/lib/env";
import { verifyPassword } from "@/lib/password";
import {
  buildYourSpotifyData,
  mapYourSpotifyData,
} from "@/lib/sources/your-spotify";
import { runPlaysIngest } from "@/lib/sync/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Vérifie un en-tête `Authorization: Basic <email:mot de passe>`. */
async function userFromBasic(header: string | null) {
  if (!header || !/^basic\s+/i.test(header)) return null;
  try {
    const decoded = Buffer.from(header.replace(/^basic\s+/i, ""), "base64").toString(
      "utf8",
    );
    const sep = decoded.indexOf(":");
    if (sep < 0) return null;
    const email = decoded.slice(0, sep).trim();
    const password = decoded.slice(sep + 1);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    return (await verifyPassword(password, user.passwordHash)) ? user : null;
  } catch {
    return null;
  }
}

/**
 * Import d'un dump *Your Spotify* envoyé en POST.
 *
 * Authentification (au choix) :
 *   - `Authorization: Bearer <SYNC_TOKEN>`  (jeton global, peut cibler un compte)
 *   - `Authorization: Basic <base64(email:mot de passe)>`  (compte standard)
 *   - session admin (cookie)
 *
 * Corps : l'archive `.zip` du dump (les 4 collections `infos`, `tracks`,
 * `albums`, `artists` en `.bson`).
 *
 * Exemples depuis le serveur Your Spotify :
 *   # avec un compte standard
 *   curl -u 'vous@exemple.com:motdepasse' --data-binary @ys-dump.zip \
 *     https://mon-domaine/api/import/your-spotify
 *
 *   # avec le jeton global
 *   curl -H "Authorization: Bearer $SYNC_TOKEN" --data-binary @ys-dump.zip \
 *     https://mon-domaine/api/import/your-spotify
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const authorization = request.headers.get("authorization");
  const tokenProvided =
    authorization?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("token") ??
    "";

  const [admin, basicUser] = await Promise.all([
    getOptionalUser(),
    userFromBasic(authorization),
  ]);
  const tokenOk = syncToken.length > 0 && tokenProvided === syncToken;
  const isAdmin = Boolean(admin?.isAdmin);

  if (!tokenOk && !isAdmin && !basicUser) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Statisfy"' } },
    );
  }

  // Cible : `?email=` (réservé au jeton/admin), sinon le compte authentifié,
  // sinon le premier administrateur.
  const email = url.searchParams.get("email");
  let user = null;
  if (email) {
    if (!tokenOk && !isAdmin && basicUser?.email !== email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    user = await prisma.user.findUnique({ where: { email } });
  } else if (basicUser) {
    user = basicUser;
  } else {
    user =
      (await prisma.user.findFirst({
        where: { isAdmin: true },
        orderBy: { createdAt: "asc" },
      })) ?? (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }));
  }
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
