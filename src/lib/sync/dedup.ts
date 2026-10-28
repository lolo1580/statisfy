import type { RawPlay } from "../sources/types";

/**
 * Clé de déduplication stable par fournisseur, piste et horodatage.
 *
 * L'horodatage est ramené à la **seconde** : les sources n'ont pas la même
 * précision (API « recently played » = millisecondes, export « extended » =
 * secondes), ce qui créait des doublons entre une synchro et un import de la
 * même écoute (la contrainte unique portant sur `dedupKey` ne les rattrapait
 * pas).
 */
export function buildDedupKey(play: RawPlay): string {
  const identity =
    play.externalTrackId ??
    `${play.artistName.trim().toLowerCase()}::${play.trackName.trim().toLowerCase()}`;
  const second = Math.floor(play.playedAt.getTime() / 1000) * 1000;
  return `${play.provider}|${identity}|${new Date(second).toISOString().slice(0, 19)}Z`;
}
