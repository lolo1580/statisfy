/**
 * Règles pures des accès Spotify (sans accès base), pour rester testables.
 */

export const SPOTIFY_ACCESS_NONE = "none";
export const SPOTIFY_ACCESS_PENDING = "pending";
export const SPOTIFY_ACCESS_APPROVED = "approved";
export const SPOTIFY_ACCESS_REJECTED = "rejected";

export type SpotifyAccessStatus =
  | typeof SPOTIFY_ACCESS_NONE
  | typeof SPOTIFY_ACCESS_PENDING
  | typeof SPOTIFY_ACCESS_APPROVED
  | typeof SPOTIFY_ACCESS_REJECTED;

/**
 * L'utilisateur peut-il connecter son compte Spotify ?
 *
 * Autorisé si administrateur, si la demande a été approuvée, ou si une
 * connexion Spotify existe déjà (compatibilité avec les installations
 * antérieures à la mise en place de la validation).
 */
export function isSpotifyAccessGranted(input: {
  isAdmin: boolean;
  status: string;
  hasConnection: boolean;
}): boolean {
  if (input.isAdmin) return true;
  if (input.status === SPOTIFY_ACCESS_APPROVED) return true;
  return input.hasConnection;
}
