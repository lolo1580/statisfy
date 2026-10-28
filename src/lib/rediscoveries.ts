/**
 * Scoring des « redécouvertes » — logique pure, testable sans base.
 *
 * Un bon candidat est à la fois :
 * - **aimé** (beaucoup d'écoutes) ;
 * - **délaissé** depuis longtemps ;
 * - **installé dans le temps** (pas un simple binge d'une soirée) ;
 * - **régulier** (écouté sur plusieurs mois).
 *
 * Le score est volontairement sublinéaire sur le nombre d'écoutes : un artiste
 * écouté 500 fois ne doit pas écraser systématiquement un artiste écouté 40 fois,
 * sinon la section ne remonte que les mêmes têtes d'affiche.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type RediscoveryCandidate = {
  plays: number;
  msPlayed: number;
  lastPlayedAt: Date;
  firstPlayedAt: Date;
  /** Nombre de mois distincts avec au moins une écoute. */
  activeMonths: number;
};

export type ScoredRediscovery<T> = {
  item: T;
  score: number;
  /** Ancienneté de la dernière écoute, en jours. */
  daysSince: number;
};

/** Arrondit un score à 3 décimales (stable pour les tests et les aperçus). */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function rediscoveryScore(
  candidate: RediscoveryCandidate,
  now: Date = new Date(),
): { score: number; daysSince: number } {
  const daysSince = Math.max(
    0,
    (now.getTime() - candidate.lastPlayedAt.getTime()) / DAY_MS,
  );
  const spanDays = Math.max(
    0,
    (candidate.lastPlayedAt.getTime() - candidate.firstPlayedAt.getTime()) /
      DAY_MS,
  );

  // Affection : racine carrée pour rester sublinéaire.
  const affection = Math.sqrt(Math.max(0, candidate.plays));
  // Silence : +1 à partir du seuil, plafonné à +3 (au-delà de ~9 mois, une
  // écoute plus ancienne n'est pas « plus oubliée »).
  const silence = 1 + Math.min(3, daysSince / 90);
  // Longévité : bonus si la relation s'est étalée sur plusieurs mois.
  const longevity = 1 + Math.min(0.5, spanDays / 730);
  // Régularité : un artiste écouté sur 3 mois distincts est un vrai coup de cœur.
  const regularity =
    candidate.activeMonths >= 3 ? 1 : candidate.activeMonths === 2 ? 0.85 : 0.7;

  return {
    score: round(affection * silence * longevity * regularity),
    daysSince: Math.round(daysSince),
  };
}

/** Trie les candidats par score décroissant (puis écoutes, puis ancienneté). */
export function rankRediscoveries<T extends RediscoveryCandidate>(
  candidates: readonly T[],
  now: Date = new Date(),
): ScoredRediscovery<T>[] {
  return candidates
    .map((item) => ({ item, ...rediscoveryScore(item, now) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.item.plays - a.item.plays ||
        b.daysSince - a.daysSince,
    );
}

/**
 * Sélectionne au plus `limit` artistes en privilégiant la diversité des genres
 * principaux (premier genre renseigné). Si les genres ne suffisent pas, on
 * complète avec les meilleurs scores restants.
 */
export function pickDiverseRediscoveries<T extends { genres: string[] }>(
  ranked: readonly ScoredRediscovery<T>[],
  limit: number,
): ScoredRediscovery<T>[] {
  if (limit <= 0) return [];

  const picked = new Set<ScoredRediscovery<T>>();
  const genres = new Set<string>();

  for (const entry of ranked) {
    const genre = entry.item.genres[0]?.trim().toLowerCase();
    if (genre && genres.has(genre)) continue;

    picked.add(entry);
    if (genre) genres.add(genre);
    if (picked.size >= limit) break;
  }

  // Pas assez de genres distincts : complète dans l'ordre du score.
  if (picked.size < limit) {
    for (const entry of ranked) {
      picked.add(entry);
      if (picked.size >= limit) break;
    }
  }

  return ranked.filter((entry) => picked.has(entry)).slice(0, limit);
}
