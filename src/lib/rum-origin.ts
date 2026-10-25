/**
 * Parsing de l'URL OpenObserve (partagé par le proxy CSP et la configuration).
 *
 * Le SDK navigateur attend `site` **sans protocole** (ex. `obs.example.com`)
 * et construit lui-même `http(s)://{site}/rum/v1/{org}/rum`. On conserve donc
 * l'éventuel chemin (instance derrière un reverse proxy) et on expose l'origine
 * pour le CSP `connect-src`.
 */

export type OpenObserveUrl = {
  /** `host[:port]` + chemin éventuel, sans slash final ni protocole. */
  site: string;
  insecureHTTP: boolean;
  /** Origine (`https://host[:port]`) pour le CSP. */
  origin: string;
};

export function parseOpenObserveUrl(
  raw: string | undefined | null,
): OpenObserveUrl | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Le SDK OpenObserve accepte `host:port` sans protocole. On accepte aussi
  // cette forme et on suppose HTTP (instances locales) ; utilisez explicitement
  // `https://…` pour TLS.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const path = url.pathname.replace(/\/+$/, "");
  return {
    site: `${url.host}${path}`,
    insecureHTTP: url.protocol === "http:",
    origin: url.origin,
  };
}
