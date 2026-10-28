import { NextResponse, type NextRequest } from "next/server";
import { loadStatsApiPayload } from "@/lib/api/public-stats";
import {
  authorizeStatsRequest,
  statsInvalidRange,
} from "@/lib/api/stats-request";
import { isRangePreference } from "@/lib/range";

export const dynamic = "force-dynamic";

/**
 * Statistiques publiques en lecture seule, pour un widget de tableau de bord.
 *
 * Auth : `Authorization: Bearer <jeton>` ou `?token=<jeton>` (jeton généré
 * depuis « Réglages → Données personnelles »). La réponse est volontairement
 * plate (pas d'objets imbriqués) pour être mappée directement dans Homepage.
 *
 * Exemple :
 *   GET /api/public/stats?range=30&token=...
 */
export async function GET(request: NextRequest) {
  const range = request.nextUrl.searchParams.get("range") ?? "30";
  if (!isRangePreference(range)) return statsInvalidRange(request);

  const auth = await authorizeStatsRequest(request);
  if ("response" in auth) return auth.response;
  const payload = await loadStatsApiPayload(auth.user, range);

  return NextResponse.json(payload, {
    headers: {
      // Les widgets interrogent souvent l'API : un cache court évite de
      // recalculer les agrégations à chaque rafraîchissement.
      "Cache-Control": "private, max-age=60",
      Vary: "Authorization",
    },
  });
}
