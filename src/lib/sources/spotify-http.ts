import "server-only";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_DELAY_MS = 30_000;
const BASE_DELAY_MS = 500;

/**
 * Délai (ms) avant une nouvelle tentative : `Retry-After` s'il est fourni,
 * sinon un backoff exponentiel plafonné.
 */
export function retryDelayMs(
  retryAfterHeader: string | null,
  attempt: number,
): number {
  const seconds = Number(retryAfterHeader);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, MAX_DELAY_MS);
  }
  return Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
}

export type SpotifyFetchOptions = { maxAttempts?: number };

/**
 * `fetch` vers l'API Spotify avec respect des limites de débit : réessaie les
 * réponses `429` (en honorant `Retry-After`) et `5xx` avec un backoff
 * exponentiel, puis renvoie la dernière réponse.
 */
export async function spotifyFetch(
  input: string | URL,
  init?: RequestInit,
  options: SpotifyFetchOptions = {},
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? 4;
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(input, init);
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= maxAttempts - 1) return res;
    await sleep(retryDelayMs(res.headers.get("retry-after"), attempt));
  }
}

/** Extrait un message lisible du corps d'erreur Spotify (consomme la réponse). */
export async function spotifyErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as {
      error?: { status?: number; message?: string } | string;
      error_description?: string;
    };
    if (data.error && typeof data.error === "object" && data.error.message) {
      return data.error.message;
    }
    if (typeof data.error === "string") {
      return data.error_description
        ? `${data.error} : ${data.error_description}`
        : data.error;
    }
    if (data.error_description) return data.error_description;
  } catch {
    // corps illisible ou vide
  }
  return `HTTP ${res.status}`;
}
