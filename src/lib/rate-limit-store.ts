/**
 * Limiteur de débit en mémoire (fenêtre fixe, par clé).
 *
 * Isolé de tout contexte Next (pas de `server-only`, pas de `next/headers`)
 * afin de rester testable en environnement Node.
 *
 * Suffisant pour une instance auto-hébergée mono-processus : les compteurs
 * sont locaux et réinitialisés au redémarrage.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

/**
 * Retire les seaux expirés ; si le plafond reste atteint (flood de clés
 * distinctes), évince les plus anciens pour **borner la mémoire**.
 */
function evict(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  while (buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

/** Consomme un jeton ; renvoie `false` si la limite est dépassée. */
export function takeToken(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) evict(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/** Réinitialise le compteur d'une clé (ex. après une connexion réussie). */
export function resetTokens(key: string): void {
  buckets.delete(key);
}

/** Nombre total de seaux suivis (utile aux tests / au diagnostic). */
export function bucketCount(): number {
  return buckets.size;
}
