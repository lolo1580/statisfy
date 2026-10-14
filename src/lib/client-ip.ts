import { isIP } from "node:net";

/**
 * Normalise une valeur d'en-tête de proxy en adresse IP valide.
 * Accepte une éventuelle forme `1.2.3.4:port` (proxy mal configuré) en ne
 * conservant que l'IP. Renvoie `null` si la valeur n'est pas une IP.
 */
export function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (isIP(raw)) return raw;
  const withPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(raw);
  if (withPort && isIP(withPort[1])) return withPort[1];
  return null;
}

/**
 * Détermine l'IP du client à partir des en-têtes de proxy.
 *
 * On retient le **dernier** saut de `X-Forwarded-For` (celui ajouté par le proxy
 * le plus proche), **uniquement s'il s'agit d'une IP valide** : on ne retombe
 * jamais sur un saut antérieur, potentiellement forgé par le client. À défaut,
 * on essaie `X-Real-IP`, puis « local ».
 */
export function pickClientIp(
  forwardedFor: string | null | undefined,
  realIp: string | null | undefined,
): string {
  if (forwardedFor) {
    const parts = forwardedFor
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const last = parts.length > 0 ? normalizeIp(parts[parts.length - 1]) : null;
    if (last) return last;
  }
  return normalizeIp(realIp) ?? "local";
}
