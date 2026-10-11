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

export type SpotifyFetchOptions = { maxAttempts?: number; timeoutMs?: number };

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * `fetch` vers l'API Spotify avec respect des limites de débit : réessaie les
 * réponses `429` (en honorant `Retry-After`) et `5xx` avec un backoff
 * exponentiel, ainsi que les erreurs réseau / timeouts. Applique un **timeout**
 * par défaut pour qu'une connexion qui pend ne bloque pas la synchronisation.
 */
export async function spotifyFetch(
  input: string | URL,
  init?: RequestInit,
  options: SpotifyFetchOptions = {},
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? 4;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  for (let attempt = 0; ; attempt += 1) {
    const signal = init?.signal ?? AbortSignal.timeout(timeoutMs);
    let res: Response;
    try {
      res = await fetch(input, { ...init, signal });
    } catch (error) {
      // Erreur réseau ou dépassement du délai : nouvelle tentative.
      if (attempt >= maxAttempts - 1) throw error;
      await sleep(retryDelayMs(null, attempt));
      continue;
    }
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
