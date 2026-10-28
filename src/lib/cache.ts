/**
 * Cache mémoire TTL, générique et testable.
 *
 * Objectifs :
 * - éviter de recalculer les mêmes agrégations à chaque navigation ;
 * - **dédupliquer** les chargements concurrents (deux onglets, prefetch…) ;
 * - rester borné en mémoire (purge des entrées expirées + éviction FIFO) ;
 * - pouvoir être invalidé par préfixe après une synchronisation ou un import.
 *
 * Limite assumée : le cache est **par processus**. Avec plusieurs répliques,
 * chaque instance a le sien ; un cache partagé (Redis) viendra avec le lot
 * « ops » de la 1.5. La durée de vie courte (60 s par défaut) borne l'impact.
 */

type Entry = { value: unknown; expiresAt: number };

// Borné volontairement bas : les valeurs mises en cache peuvent être
// volumineuses (séries quotidiennes, classements) et la durée de vie est courte.
const DEFAULT_MAX_ENTRIES = 500;

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

let epoch = 0;

export type CacheStats = { size: number; inflight: number; epoch: number };

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

/**
 * Lit une entrée valide. Renvoie `undefined` si absente ou expirée.
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
 * Renvoie la valeur en cache ou charge `load()`, puis la mémorise.
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
  const promise = load()
    .then((value) => {
      if (startEpoch === epoch) {
        const now = Date.now();
        evict(maxEntries, now);
        store.set(key, { value, expiresAt: now + ttlMs });
      }
      return value;
    })
    .finally(() => {
      // Ne supprime que sa propre promesse (une invalidation a pu la remplacer).
      if (inflight.get(key) === promise) inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/**
 * Invalide tout le cache, ou seulement les clés commençant par `prefix`.
 * Renvoie le nombre d'entrées supprimées.
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
  return removed;
}

/** Vide tout le cache (tests, redémarrage). */
export function clearCache(): void {
  epoch += 1;
  store.clear();
  inflight.clear();
}

/** Diagnostic (tests, futur endpoint d'administration). */
export function cacheStats(): CacheStats {
  return { size: store.size, inflight: inflight.size, epoch };
}
