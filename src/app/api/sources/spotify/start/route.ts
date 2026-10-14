import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/dal";
import { buildSpotifyAuthUrl } from "@/lib/sources/spotify";
import { canConnectSpotify } from "@/lib/spotify-access";
import {
  normalizeOrigin,
  requestOrigin,
  signOAuthState,
} from "@/lib/sources/spotify-state";
import { appUrl, cookieDomain, spotify } from "@/lib/env";
import { logEvent } from "@/lib/log";

export const dynamic = "force-dynamic";

export async function GET() {
  // Redirige vers /login si la session est absente.
  const user = await getCurrentUser();

  // Origine de l'interface (localhost en dev, domaine public en prod).
  const origin =
    normalizeOrigin(await requestOrigin()) ??
    normalizeOrigin(appUrl) ??
    "http://127.0.0.1:3000";

  if (!spotify.configured) {
    return NextResponse.redirect(`${origin}/settings/sources?error=spotify_config`);
  }

  // L'accès à l'API Spotify doit avoir été validé par un administrateur.
  if (!(await canConnectSpotify(user))) {
    return NextResponse.redirect(
      `${origin}/settings/sources?error=spotify_not_approved`,
    );
  }

  // État signé : contient l'utilisateur et l'URL de retour. Il est vérifiable
  // par le callback même sur un autre hôte que celui qui a lancé l'OAuth.
  const state = await signOAuthState({ uid: user.id, ret: origin });

  const jar = await cookies();
  jar.set("spotify_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });

  await logEvent({
    level: "info",
    source: "source",
    message: "Connexion Spotify démarrée",
    userId: user.id,
  });

  return NextResponse.redirect(buildSpotifyAuthUrl(state));
}
