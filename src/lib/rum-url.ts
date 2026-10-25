/**
 * Normalisation des URLs envoyées au SDK OpenObserve.
 *
 * Objectifs :
 * - retirer query/hash (recherches, paramètres) ;
 * - réduire la cardinalité (IDs Spotify, jetons de partage) ;
 * - ne jamais envoyer les pages sensibles `/settings` et `/admin`.
 *
 * Client-safe : utilisé par le composant RUM et testable en Node.
 */

const SENSITIVE_PREFIXES = ["/settings", "/admin"];

export function isSensitiveRumPath(pathname: string): boolean {
  return SENSITIVE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Vrai si l'URL pointe vers une page sensible (ou est invalide). */
export function isSensitiveRumUrl(rawUrl: string): boolean {
  try {
    return isSensitiveRumPath(new URL(rawUrl, "http://localhost").pathname);
  } catch {
    return true;
  }
}

/**
 * Renvoie l'URL normalisée, ou `null` si elle est invalide.
 * Les pages sensibles sont **rédigées** (`/settings/[redacted]`) plutôt que
 * supprimées : le SDK OpenObserve refuse de supprimer les événements `view`.
 */
export function normalizeRumUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith("/") && !/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmed, "http://localhost");
  } catch {
    return null;
  }

  if (isSensitiveRumPath(url.pathname)) {
    const segment = url.pathname.split("/").filter(Boolean)[0] ?? "redacted";
    return `${url.origin}/${segment}/[redacted]`;
  }

  const path = url.pathname
    .replace(/^\/artist\/[^/]+/, "/artist/[id]")
    .replace(/^\/track\/[^/]+/, "/track/[id]")
    .replace(/^\/share\/wrapped\/[^/]+/, "/share/wrapped/[token]")
    .replace(/^\/share\/profile\/[^/]+/, "/share/profile/[token]");

  return `${url.origin}${path}`;
}
