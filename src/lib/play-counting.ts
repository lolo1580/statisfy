/**
 * Règle de comptabilisation d'une écoute.
 *
 * Une écoute ne compte dans les statistiques que si au moins
 * `MIN_LISTEN_RATIO` (3/4 par défaut) de la piste a été écouté. La durée de
 * référence est celle connue au moment de l'ingestion (durée portée par
 * l'écoute, sinon durée de la piste).
 *
 * Si la durée est inconnue (certains imports ne la fournissent pas), l'écoute
 * est comptée : on ne peut pas prouver qu'il s'agit d'un skip.
 *
 * Le seuil est configurable (réglage admin) ; il est passé aux fonctions de
 * calcul plutôt que lu ici, pour rester testable et sans dépendance serveur.
 */
export const MIN_LISTEN_RATIO = 0.75;

/** Ramène un seuil arbitraire dans une plage valide `]0, 1]`. */
export function safeListenRatio(ratio: number | null | undefined): number {
  return typeof ratio === "number" &&
    Number.isFinite(ratio) &&
    ratio >= 0 &&
    ratio <= 1
    ? ratio
    : MIN_LISTEN_RATIO;
}

export function isPlayCounted(
  msPlayed: number,
  durationMs: number | null | undefined,
  ratio: number = MIN_LISTEN_RATIO,
): boolean {
  if (!durationMs || durationMs <= 0) return true;
  return msPlayed >= durationMs * safeListenRatio(ratio);
}
