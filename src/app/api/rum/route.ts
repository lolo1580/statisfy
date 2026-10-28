import { NextResponse, type NextRequest } from "next/server";
import { getRumConfig, recordRumForward } from "@/lib/rum";
import { appUrl } from "@/lib/env";
import { pickClientIp } from "@/lib/client-ip";
import { readBodyLimited } from "@/lib/http-body";
import { takeToken } from "@/lib/rate-limit-store";

export const dynamic = "force-dynamic";

/** Corps maximal : petits lots RUM/logs, replay potentiellement volumineux. */
const MAX_EVENT_BODY_BYTES = 256 * 1024;
const MAX_REPLAY_BODY_BYTES = 5 * 1024 * 1024;
const RATE_LIMIT = 240;
const RATE_WINDOW_MS = 60_000;

/**
 * Vérifie que l'appel vient bien de l'application (protection CSRF/abus).
 * `Sec-Fetch-Site` est le signal le plus fiable dans les navigateurs modernes ;
 * `Origin` sert de repli (et couvre les navigateurs plus anciens).
 */
function isSameOrigin(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true; // client non-navigateur (test/curl) : rate-limit s'applique
  const allowed = new Set<string>([request.nextUrl.origin]);
  if (appUrl) allowed.add(appUrl.replace(/\/+$/, ""));

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "");
  if (host) allowed.add(`${proto}://${host}`);

  return allowed.has(origin);
}

/**
 * Relais same-origin pour le SDK OpenObserve.
 *
 * Le SDK est configuré avec `proxy: "/api/rum"` : il envoie ses lots ici avec
 * `?o2forward=/rum/v1/{org}/rum?...`. Le serveur ajoute le vrai jeton
 * (`o2-api-key`) puis transmet à OpenObserve. Le CSP reste `connect-src 'self'`
 * et le jeton n'est jamais exposé au navigateur.
 */
export async function POST(request: NextRequest) {
  const config = await getRumConfig();
  if (!config) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Cross-origin request refused" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rawIp = pickClientIp(
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
  );
  // Pas de seau partagé « local » : sans IP fiable, la limite par IP est
  // simplement ignorée (les autres protections restent en place).
  const ip = rawIp === "local" ? null : rawIp;
  if (ip && !takeToken(`rum-proxy:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return new NextResponse(null, {
      status: 429,
      headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }

  const forward = request.nextUrl.searchParams.get("o2forward");
  if (!forward) {
    return NextResponse.json({ error: "Missing o2forward" }, { status: 400 });
  }

  const prefix = `/rum/v1/${config.organizationIdentifier}/`;
  if (!forward.startsWith(prefix) || forward.includes("..")) {
    return NextResponse.json({ error: "Invalid o2forward" }, { status: 400 });
  }
  const track = forward.slice(prefix.length).split("?")[0];
  if (track !== "rum" && track !== "logs" && track !== "replay") {
    return NextResponse.json({ error: "Invalid o2forward" }, { status: 400 });
  }

  const target = new URL(config.baseUrl + forward);
  // Double garde : la cible doit rester sur l'instance OpenObserve configurée.
  if (target.origin !== new URL(config.baseUrl).origin) {
    return NextResponse.json({ error: "Invalid target" }, { status: 400 });
  }
  // Le client envoie un jeton factice (`proxy`) : on injecte le vrai ici.
  target.searchParams.set("o2-api-key", config.clientToken);

  const body = await readBodyLimited(
    request,
    track === "replay" ? MAX_REPLAY_BODY_BYTES : MAX_EVENT_BODY_BYTES,
  );
  if (!body) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const headers: Record<string, string> = {
    "Content-Type":
      request.headers.get("content-type") ?? "text/plain;charset=UTF-8",
  };
  const encoding = request.headers.get("content-encoding");
  if (encoding) headers["Content-Encoding"] = encoding;

  // Copie dans un ArrayBuffer « simple » (les types DOM n'acceptent pas
  // `Uint8Array<ArrayBufferLike>` directement comme corps de requête).
  const arrayBuffer = new ArrayBuffer(body.byteLength);
  new Uint8Array(arrayBuffer).set(body);

  try {
    const response = await fetch(target, {
      method: "POST",
      headers,
      body: arrayBuffer,
      signal: AbortSignal.timeout(6_000),
      cache: "no-store",
      redirect: "manual",
    });
    await recordRumForward(track, {
      ok: response.ok,
      status: response.status,
    });
    return new NextResponse(null, {
      status: response.ok ? 204 : 502,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    await recordRumForward(track, {
      ok: false,
      status: null,
      error: "network",
    });
    return new NextResponse(null, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
