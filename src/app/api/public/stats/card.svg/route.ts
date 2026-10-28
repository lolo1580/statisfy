import type { NextRequest } from "next/server";
import { loadStatsApiPayload } from "@/lib/api/public-stats";
import { renderStatsCard, type StatsCardTheme } from "@/lib/api/stats-card";
import {
  authorizeStatsRequest,
  statsInvalidRange,
} from "@/lib/api/stats-request";
import { isRangePreference } from "@/lib/range";

export const dynamic = "force-dynamic";

/**
 * Carte SVG publique (badge) : `GET /api/public/stats/card.svg?token=...`
 *
 * Paramètres : `range`, `theme=dark|light`, `locale=en|fr`.
 * Même authentification que `/api/public/stats`. Le SVG ne contient aucune
 * ressource externe (pas d'image, pas de script).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const range = params.get("range") ?? "30";
  if (!isRangePreference(range)) return statsInvalidRange(request);

  const auth = await authorizeStatsRequest(request);
  if ("response" in auth) return auth.response;
  const theme: StatsCardTheme =
    params.get("theme") === "light" ? "light" : "dark";
  const locale = params.get("locale") === "fr" ? "fr" : "en";

  const payload = await loadStatsApiPayload(auth.user, range);
  const svg = renderStatsCard(payload, { theme, locale });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, max-age=300",
      Vary: "Authorization",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
