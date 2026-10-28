/**
 * Abstraction des sources d'écoute.
 *
 * Chaque source (Spotify, import de fichiers) renvoie une liste d'écoutes
 * normalisées `RawPlay`. Le moteur d'ingestion se charge ensuite de créer /
 * retrouver les entités et d'insérer les écoutes de façon idempotente.
 */

export type SourceType = "spotify" | "import";

export type RawPlay = {
  provider: SourceType;
  /**
   * Origine réelle de l'écoute (sync live vs import de fichiers). Sert au
   * classement par « source » ; par défaut on retombe sur `provider`.
   */
  origin?: SourceType;
  /** Identifiants côté fournisseur (facultatif selon la source). */
  externalTrackId?: string;
  externalArtistId?: string;
  externalAlbumId?: string;
  trackName: string;
  artistName: string;
  albumName?: string;
  durationMs?: number;
  imageUrl?: string;
  /** Image de profil de l'artiste (distincte de la pochette d'album). */
  artistImageUrl?: string;
  genres?: string[];
  isrc?: string;
  playedAt: Date;
  msPlayed?: number;
  context?: string;
  /** Métadonnées de l'export étendu Spotify (facultatives). */
  platform?: string;
  country?: string;
  skipped?: boolean;
  shuffle?: boolean;
  offline?: boolean;
  incognito?: boolean;
  reasonStart?: string;
  reasonEnd?: string;
};

export type SyncContext = {
  connectionId: string;
  /** Configuration non sensible (options, région...). */
  config: Record<string, unknown>;
  /** Identifiants déchiffrés (tokens OAuth, clé API...). */
  credentials: Record<string, unknown>;
  /** Ne récupérer que les écoutes postérieures à cette date. */
  since: Date | null;
};

export interface SourceAdapter {
  type: SourceType;
  label: string;
  /** Récupère un lot d'écoutes récentes depuis la source. */
  fetchPlays(ctx: SyncContext): Promise<RawPlay[]>;
}
