import "server-only";

import { NextResponse } from "next/server";
import { pickClientIp } from "../client-ip";
import { takeToken } from "../rate-limit-store";
import {
  getStatsApiUser,
  readStatsToken,
  type StatsApiUser,
} from "./public-stats";

/**
 * Authentification commune aux routes publiques de statistiques
 * (`/api/public/stats` et `/api/public/stats/card`).
 *
 * Deux limites s'appliquent : par IP (freine l'énumération de jetons) puis par
 * compte (borne le coût des agrégations). Le jeton est accepté en en-tête
 * `Authorization: Bearer` ou en `?token=`.
 */

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 120;

export function statsRateLimited(): NextResponse {
  return NextResponse.json(
    { error: "Too many requests, try again later." },
    {
      status: 429,
      headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    },
  );
}

export function statsUnauthorized(message = "Unauthorized"): NextResponse {
  return NextResponse.json(
    {
      error: message,
      hint: "Provide ?token=<stats API token> or Authorization: Bearer <token>.",
    },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export async function authorizeStatsRequest(
  request: Request,
): Promise<{ user: StatsApiUser } | { response: NextResponse }> {
  const ip = pickClientIp(
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
  );
  if (!takeToken(`stats-api:ip:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return { response: statsRateLimited() };
  }

  const token = readStatsToken(request);
  if (!token) return { response: statsUnauthorized() };

  const user = await getStatsApiUser(token);
  if (!user) return { response: statsUnauthorized() };

  if (!takeToken(`stats-api:user:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return { response: statsRateLimited() };
  }

  return { user };
}
