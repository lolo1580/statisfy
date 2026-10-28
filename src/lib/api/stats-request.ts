import "server-only";

import { NextResponse } from "next/server";
import { pickClientIp } from "../client-ip";
import { takeToken } from "../rate-limit-store";
import { apiMessage, type ApiMessageKey } from "./messages";
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
 *
 * Les erreurs sont localisées (`Accept-Language`) et portent un `code` stable
 * pour les clients : `unauthorized`, `rate_limited`, `invalid_range`.
 */

const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 120;

/** Réponse d'erreur JSON cohérente (message localisé + code stable). */
export function statsError(
  request: Request,
  status: number,
  code: string,
  key: ApiMessageKey,
  options: { hint?: boolean; headers?: Record<string, string> } = {},
): NextResponse {
  return NextResponse.json(
    {
      error: apiMessage(request, key),
      code,
      ...(options.hint
        ? { hint: apiMessage(request, "unauthorizedHint") }
        : {}),
    },
    {
      status,
      headers: { "Cache-Control": "no-store", ...options.headers },
    },
  );
}

export function statsRateLimited(request: Request): NextResponse {
  return statsError(request, 429, "rate_limited", "rateLimited", {
    headers: { "Retry-After": "60" },
  });
}

export function statsUnauthorized(request: Request): NextResponse {
  return statsError(request, 401, "unauthorized", "unauthorized", {
    hint: true,
  });
}

export function statsInvalidRange(request: Request): NextResponse {
  return statsError(request, 400, "invalid_range", "invalidRange");
}

export async function authorizeStatsRequest(
  request: Request,
): Promise<{ user: StatsApiUser } | { response: NextResponse }> {
  const rawIp = pickClientIp(
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
  );
  // `pickClientIp` renvoie « local » quand l'IP n'est pas déterminable. On ne
  // crée alors **pas** de seau commun : tous les clients anonymes partageraient
  // la même limite, ce qui transformerait une protection par IP en blocage
  // global (cf. `auth/rate-limit.ts`).
  const ip = rawIp === "local" ? null : rawIp;
  if (ip && !takeToken(`stats-api:ip:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return { response: statsRateLimited(request) };
  }

  const token = readStatsToken(request);
  if (!token) return { response: statsUnauthorized(request) };

  const user = await getStatsApiUser(token);
  if (!user) return { response: statsUnauthorized(request) };

  if (!takeToken(`stats-api:user:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return { response: statsRateLimited(request) };
  }

  return { user };
}
