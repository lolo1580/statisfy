import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

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
    if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) {
      return true;
    }
    if (lower.startsWith("::ffff:")) {
      return isPrivateIp(lower.slice("::ffff:".length));
    }
    return false;
  }
  // Ni IPv4 ni IPv6 valide : on bloque par prudence.
  return true;
}

/** Valide une URL http(s) vers un hôte public (résolution DNS incluse). */
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("URL invalide.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Protocole non autorisé.");
  }

  const host = url.hostname;
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new Error("Hôte non autorisé.");
  }

  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Adresse privée refusée.");
    return url;
  }

  const addresses = await lookup(host, { all: true });
  if (addresses.length === 0) throw new Error("Hôte introuvable.");
  if (addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new Error("Adresse privée refusée.");
  }
  return url;
}
