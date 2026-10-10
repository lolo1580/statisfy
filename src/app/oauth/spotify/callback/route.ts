import type { NextRequest } from "next/server";
import { handleSpotifyCallback } from "@/lib/sources/spotify-oauth";

export const dynamic = "force-dynamic";

/**
 * Chemin de retour OAuth alternatif (compatibilité avec les configurations
 * où l'URL autorisée dans Spotify est `/oauth/spotify/callback`).
 */
export async function GET(request: NextRequest) {
  return handleSpotifyCallback(request);
}
