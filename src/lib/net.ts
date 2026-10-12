import "server-only";

import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";

const MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_BYTES = 6 * 1024 * 1024;

/**
 * Garde anti-SSRF pour les URLs distantes stockées en base (pochettes/artistes).
 * Les imports « Your Spotify » peuvent contenir des URLs arbitraires ; on
 * refuse tout ce qui n'est pas http(s) vers un hôte public.
 */
export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // lien-local / métadonnées cloud
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / réservé
    return false;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80:")) return true; // lien-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA fc00::/7
    if (lower.startsWith("ff")) return true; // multicast ff00::/8
    if (lower.startsWith("100:")) return true; // 100::/64 (discard-only)
    if (lower.startsWith("2001:db8:")) return true; // documentation
    if (lower.startsWith("64:ff9b:")) return true; // NAT64 (par prudence)
    if (lower.startsWith("::ffff:")) {
      // IPv4-mappée : on ré-évalue la partie IPv4 (forme pointée ou hexadécimale).
      const rest = lower.slice("::ffff:".length);
      if (isIP(rest) === 4) return isPrivateIp(rest);
      // Forme canonique hexadécimale (ex. `::ffff:7f00:1`) : on bloque par prudence.
      return true;
    }
    return false;
  }
  // Ni IPv4 ni IPv6 valide : on bloque par prudence.
  return true;
}

/** Hôtes textuellement réservés (suffixes locaux). */
function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  );
}

type Resolved = { address: string; family: 4 | 6 };

/** Valide le schéma et l'hôte (sans résolution DNS). */
function parseHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("URL invalide.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Protocole non autorisé.");
  }
  if (isBlockedHostname(url.hostname)) throw new Error("Hôte non autorisé.");
  return url;
}

/** Résout l'hôte et renvoie une adresse **publique** à épingler. */
async function resolvePublic(hostname: string): Promise<Resolved> {
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("Adresse privée refusée.");
    return { address: hostname, family: isIP(hostname) as 4 | 6 };
  }
  const addresses = await lookup(hostname, { all: true });
  const ok = addresses.find((entry) => !isPrivateIp(entry.address));
  if (!ok) throw new Error("Adresse privée refusée.");
  return { address: ok.address, family: ok.family as 4 | 6 };
}

/** Valide une URL http(s) vers un hôte public (résolution DNS incluse). */
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  const url = parseHttpUrl(raw);
  await resolvePublic(url.hostname);
  return url;
}

export type PublicFetchResult = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type PublicFetchInit = {
  timeoutMs?: number;
  maxBytes?: number;
  signal?: AbortSignal;
};

/**
 * Requête HTTP(S) **épinglée** sur l'adresse déjà validée : on se connecte
 * directement à l'IP (avec le `Host` et le `servername` SNI d'origine), sans
 * re-résoudre le DNS au moment du `connect` — ferme le TOCTOU de rebinding.
 */
function requestPinned(
  url: URL,
  pinned: Resolved,
  opts: { timeoutMs: number; maxBytes: number; signal?: AbortSignal },
): Promise<PublicFetchResult> {
  const isHttps = url.protocol === "https:";
  const mod = isHttps ? https : http;
  const port = url.port ? Number(url.port) : isHttps ? 443 : 80;
  const requestOptions: https.RequestOptions = {
    host: pinned.address,
    port,
    path: `${url.pathname}${url.search}`,
    method: "GET",
    headers: {
      host: url.host,
      "user-agent": "Statisfy (+https://github.com/lolo1580/statisfy)",
    },
    // SNI + vérification du certificat sur le nom d'origine (pas l'IP).
    ...(isHttps ? { servername: url.hostname } : {}),
  };
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) {
      reject(new Error("Requête annulée."));
      return;
    }
    const req = mod.request(requestOptions, (res) => {
      const getHeader = (name: string): string | null => {
        const value = res.headers[name.toLowerCase()];
        return Array.isArray(value) ? value.join(", ") : (value ?? null);
      };
      const chunks: Buffer[] = [];
      let total = 0;
      res.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > opts.maxBytes) {
          req.destroy(new Error("Réponse trop volumineuse."));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        const status = res.statusCode ?? 0;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          headers: { get: getHeader },
          arrayBuffer: async () =>
            body.buffer.slice(
              body.byteOffset,
              body.byteOffset + body.byteLength,
            ) as ArrayBuffer,
        });
      });
      res.on("error", reject);
    });
    if (opts.signal) {
      opts.signal.addEventListener(
        "abort",
        () => req.destroy(new Error("Requête annulée.")),
        { once: true },
      );
    }
    req.setTimeout(opts.timeoutMs, () =>
      req.destroy(new Error("Délai dépassé.")),
    );
    req.on("error", reject);
    req.end();
  });
}

/**
 * `fetch` vers une URL http(s) publique, en **revalidant et épinglant chaque
 * redirection** : un hôte public peut rediriger vers `169.254.169.254` ou un
 * service interne, ce qui contournerait la garde. On suit donc les
 * redirections manuellement, en ré-appliquant la garde avant chaque saut.
 */
export async function fetchPublicUrl(
  raw: string,
  init: PublicFetchInit = {},
): Promise<PublicFetchResult> {
  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = init.maxBytes ?? DEFAULT_MAX_BYTES;
  let current = parseHttpUrl(raw);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const pinned = await resolvePublic(current.hostname);
    const res = await requestPinned(current, pinned, {
      timeoutMs,
      maxBytes,
      signal: init.signal,
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      current = parseHttpUrl(new URL(location, current).toString());
      continue;
    }
    return res;
  }
  throw new Error("Trop de redirections.");
}
