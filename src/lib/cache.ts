import { deserialize, serialize } from "node:v8";
import { createClient, type RedisClientType } from "redis";

/**
 * Cache à deux niveaux :
 * - **L1 mémoire** (toujours actif) : TTL, déduplication des chargements
 *   concurrents, éviction FIFO, invalidation par préfixe ;
 * - **L2 Redis** (optionnel, `REDIS_URL`) : partage entre répliques et survit
 *   aux redémarrages. Les valeurs sont sérialisées avec `v8` (Dates, BigInt,
 *   Map… conservés) puis encodées en base64.
 *
 * Le cache est **best-effort** : Redis indisponible ou en erreur ne doit jamais
 * faire échouer une requête ; on retombe silencieusement sur la mémoire.
 */

type Entry = { value: unknown; expiresAt: number };

// Borné volontairement bas : les valeurs mises en cache peuvent être
// volumineuses (séries quotidiennes, classements) et la durée de vie est courte.
const DEFAULT_MAX_ENTRIES = 500;
const REDIS_PREFIX = "statisfy:cache:";

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

let epoch = 0;
let redisPromise: Promise<RedisClientType | null> | null = null;
let redisFailed = false;
let redisStatus: CacheStats["redis"] = process.env.REDIS_URL
  ? "connecting"
  : "disabled";

export type CacheStats = {
  size: number;
  inflight: number;
  epoch: number;
  redis: "disabled" | "connecting" | "ready" | "failed";
};

/** Sérialise une valeur (conserve les Dates et les BigInt). */
export function encodeCacheValue(value: unknown): string {
  return serialize(value).toString("base64");
}

/** Désérialise une valeur ; `undefined` si le contenu est corrompu. */
export function decodeCacheValue<T>(raw: string): T | undefined {
  try {
    return deserialize(Buffer.from(raw, "base64")) as T;
  } catch {
    return undefined;
  }
}

function redisKey(key: string): string {
  return `${REDIS_PREFIX}${key}`;
}

async function getRedis(): Promise<RedisClientType | null> {
  if (redisFailed) return null;
  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (!redisPromise) {
    redisStatus = "connecting";
    redisPromise = (async () => {
      try {
        const client: RedisClientType = createClient({
          url,
          socket: { connectTimeout: 750, reconnectStrategy: false },
          disableOfflineQueue: true,
        });
        client.on("error", (error: Error) => {
          console.error("[cache] Erreur Redis :", error.message);
        });
        await client.connect();
        redisStatus = "ready";
        return client;
      } catch (error) {
        redisFailed = true;
        redisStatus = "failed";
        console.error(
          "[cache] Redis indisponible, repli sur le cache mémoire :",
          error instanceof Error ? error.message : error,
        );
        return null;
      }
    })();
  }

  return redisPromise;
}

async function redisGet<T>(key: string): Promise<T | undefined> {
  const client = await getRedis();
  if (!client) return undefined;
  try {
    const raw = await client.get(redisKey(key));
    return raw === null ? undefined : decodeCacheValue<T>(raw);
  } catch {
    return undefined;
  }
}

async function redisSet(
  key: string,
  value: unknown,
  ttlMs: number,
): Promise<void> {
  const client = await getRedis();
  if (!client) return;
  try {
    await client.set(redisKey(key), encodeCacheValue(value), { PX: ttlMs });
  } catch {
    // Best-effort : la valeur reste disponible en L1.
  }
}

async function redisInvalidate(prefix: string): Promise<void> {
  const client = await getRedis();
  if (!client) return;
  try {
    const pattern = `${redisKey(prefix)}*`;
    for await (const keys of client.scanIterator({
      MATCH: pattern,
      COUNT: 100,
    })) {
      if (keys.length > 0) await client.unlink(keys);
    }
  } catch {
    // Best-effort : les clés expireront d'elles-mêmes.
  }
}

/** Purge les entrées expirées puis les plus anciennes jusqu'à tenir la limite. */
function evict(maxEntries: number, now: number): void {
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  while (store.size >= maxEntries) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

function setMemory<T>(
  key: string,
  value: T,
  ttlMs: number,
  maxEntries: number,
): void {
  const now = Date.now();
  evict(maxEntries, now);
  store.set(key, { value, expiresAt: now + ttlMs });
}

/**
 * Lit une entrée valide en L1. Renvoie `undefined` si absente ou expirée.
 * `now` est injectable pour les tests.
 */
export function cacheGet<T>(
  key: string,
  now: number = Date.now(),
): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

/**
 * Renvoie la valeur en cache (L1 puis L2) ou charge `load()`, puis la mémorise.
 *
 * - `ttlMs <= 0` désactive complètement le cache (utile en test/debug) ;
 * - les appels concurrents sur la même clé partagent la même promesse ;
 * - si le cache est invalidé pendant le chargement, le résultat n'est **pas**
 *   réinséré (évite de remettre des données périmées après un import).
 */
export async function cacheGetOrSet<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  maxEntries: number = DEFAULT_MAX_ENTRIES,
): Promise<T> {
  if (ttlMs <= 0) return load();

  const cached = cacheGet<T>(key);
  if (cached !== undefined) return cached;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const startEpoch = epoch;
  const promise = (async () => {
    // On n'attend Redis que s'il est configuré : sans Redis, `load()` est
    // appelé dès l'entrée dans la promesse (pas de microtâche inutile).
    if (process.env.REDIS_URL) {
      const remote = await redisGet<T>(key);
      if (remote !== undefined) {
        setMemory(key, remote, ttlMs, maxEntries);
        return remote;
      }
    }

    const value = await load();
    if (startEpoch === epoch) {
      setMemory(key, value, ttlMs, maxEntries);
      void redisSet(key, value, ttlMs);
    }
    return value;
  })().finally(() => {
    // Ne supprime que sa propre promesse (une invalidation a pu la remplacer).
    if (inflight.get(key) === promise) inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

/**
 * Invalide tout le cache, ou seulement les clés commençant par `prefix`.
 * Renvoie le nombre d'entrées supprimées en L1 (le nettoyage Redis est
 * asynchrone et best-effort).
 */
export function invalidateCache(prefix = ""): number {
  epoch += 1;
  let removed = 0;
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      removed += 1;
    }
  }
  for (const key of [...inflight.keys()]) {
    if (key.startsWith(prefix)) inflight.delete(key);
  }
  void redisInvalidate(prefix);
  return removed;
}

/** Vide tout le cache (tests, recalcul global). */
export function clearCache(): void {
  epoch += 1;
  store.clear();
  inflight.clear();
  void redisInvalidate("");
}

/** Diagnostic (tests, futur endpoint d'administration). */
export function cacheStats(): CacheStats {
  return {
    size: store.size,
    inflight: inflight.size,
    epoch,
    redis: redisStatus,
  };
}
