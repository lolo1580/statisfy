/**
 * Abstraction des sources d'écoute.
 *
 * Chaque source (Spotify, import de fichiers) renvoie une liste d'écoutes
 * normalisées `RawPlay`. Le moteur d'ingestion se charge ensuite de créer /
 * retrouver les entités et d'insérer les écoutes de façon idempotente.
 */

export type SourceType = 'spotify' | 'import'

export const SOURCE_LABELS: Record<string, string> = {
  spotify: 'Spotify',
  import: 'Import de fichiers',
}

export type RawPlay = {
  provider: SourceType
  /** Identifiants côté fournisseur (facultatif selon la source). */
  externalTrackId?: string
  externalArtistId?: string
  externalAlbumId?: string
  trackName: string
  artistName: string
  albumName?: string
  durationMs?: number
  imageUrl?: string
  /** Image de profil de l'artiste (distincte de la pochette d'album). */
  artistImageUrl?: string
  genres?: string[]
  isrc?: string
  playedAt: Date
  msPlayed?: number
  context?: string
}

export type SyncContext = {
  connectionId: string
  /** Configuration non sensible (options, région...). */
  config: Record<string, unknown>
  /** Identifiants déchiffrés (tokens OAuth, clé API...). */
  credentials: Record<string, unknown>
  /** Ne récupérer que les écoutes postérieures à cette date. */
  since: Date | null
}

export interface SourceAdapter {
  type: SourceType
  label: string
  /** Récupère un lot d'écoutes récentes depuis la source. */
  fetchPlays(ctx: SyncContext): Promise<RawPlay[]>
}
