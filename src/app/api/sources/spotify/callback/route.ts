import type { NextRequest } from "next/server";
import { handleSpotifyCallback } from "@/lib/sources/spotify-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleSpotifyCallback(request);
}
