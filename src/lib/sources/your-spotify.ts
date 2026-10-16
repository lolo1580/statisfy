import { deserialize } from "bson";
import { safeUnzip } from "../archive";
import type { RawPlay } from "./types";

/**
 * Conversion d'une base *Your Spotify* (MongoDB) vers nos écoutes normalisées.
 *
 * Collections source :
 *   - `artists` : { id, name, genres, images }
 *   - `albums`  : { id, name, images }
 *   - `tracks`  : { id, name, duration_ms }
 *   - `infos`   : écoutes { id (track), albumId, primaryArtistId, durationMs, played_at }
 */

export type YourSpotifyImage = { url?: string };
export type YourSpotifyArtist = {
  id: string;
  name: string;
  genres?: string[];
  images?: YourSpotifyImage[];
};
export type YourSpotifyAlbum = {
  id: string;
  name: string;
  images?: YourSpotifyImage[];
};
export type YourSpotifyTrack = {
  id: string;
  name: string;
  duration_ms?: number;
};
export type YourSpotifyInfo = {
  id: string;
  albumId?: string;
  primaryArtistId?: string;
  durationMs?: number;
  played_at?: Date | string | number | { $date?: string | number | Date };
};

export type YourSpotifyData = {
  artists: YourSpotifyArtist[];
  albums: YourSpotifyAlbum[];
  tracks: YourSpotifyTrack[];
  infos: YourSpotifyInfo[];
};

function firstImage(images?: YourSpotifyImage[]): string | undefined {
  if (!Array.isArray(images) || images.length === 0) return undefined;
  return images[0]?.url;
}

/**
 * Normalise une date de dump MongoDB. `mongodump` produit des `Date`, mais
 * `mongoexport` (JSON) sérialise en Extended JSON : `{ "$date": "…" }`.
 * Sans cela, `new Date({…})` est invalide et **toutes** les écoutes sont
 * ignorées silencieusement.
 */
function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value && typeof value === "object" && "$date" in value) {
    return toDate((value as { $date?: unknown }).$date);
  }
  return null;
}

export function mapYourSpotifyData(data: YourSpotifyData): {
  plays: RawPlay[];
  skipped: number;
} {
  const artists = new Map<
    string,
    { name: string; genres?: string[]; image?: string }
  >();
  for (const artist of data.artists) {
    artists.set(artist.id, {
      name: artist.name,
      genres: artist.genres,
      image: firstImage(artist.images),
    });
  }

  const albums = new Map<string, { name: string; image?: string }>();
  for (const album of data.albums) {
    albums.set(album.id, { name: album.name, image: firstImage(album.images) });
  }

  const tracks = new Map<string, { name: string; durationMs?: number }>();
  for (const track of data.tracks) {
    tracks.set(track.id, { name: track.name, durationMs: track.duration_ms });
  }

  const plays: RawPlay[] = [];
  let skipped = 0;

  for (const info of data.infos) {
    const playedAt = toDate(info.played_at);
    if (!info.id || !playedAt) {
      skipped += 1;
      continue;
    }
    const artist = info.primaryArtistId
      ? artists.get(info.primaryArtistId)
      : undefined;
    const album = info.albumId ? albums.get(info.albumId) : undefined;
    const track = tracks.get(info.id);

    plays.push({
      provider: "spotify",
      origin: "import",
      externalTrackId: info.id,
      externalArtistId: info.primaryArtistId,
      externalAlbumId: info.albumId,
      trackName: track?.name ?? "Unknown track",
      artistName: artist?.name ?? "Unknown artist",
      albumName: album?.name,
      durationMs: track?.durationMs,
      imageUrl: album?.image,
      artistImageUrl: artist?.image,
      genres: artist?.genres,
      playedAt,
      msPlayed:
        typeof info.durationMs === "number" ? info.durationMs : undefined,
      context: "your_spotify",
    });
  }

  return { plays, skipped };
}

// --- Lecture d'un dump MongoDB ----------------------------------------------

export type UploadedFile = { name: string; data: Uint8Array };

/** Découpe un fichier `.bson` (suite de documents) en objets. */
export function parseBsonDocuments(buffer: Uint8Array): Record<string, unknown>[] {
  const documents: Record<string, unknown>[] = [];
  let offset = 0;
  while (offset + 4 <= buffer.length) {
    const size =
      buffer[offset] |
      (buffer[offset + 1] << 8) |
      (buffer[offset + 2] << 16) |
      (buffer[offset + 3] << 24);
    if (size <= 0 || offset + size > buffer.length) break;
    try {
      documents.push(
        deserialize(buffer.subarray(offset, offset + size)) as Record<
          string,
          unknown
        >,
      );
    } catch {
      break;
    }
    offset += size;
  }
  return documents;
}

/** JSON (tableau) ou JSONL (un document par ligne, sortie `mongoexport`). */
export function parseJsonDocuments(text: string): unknown[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    const out: unknown[] = [];
    for (const line of trimmed.split(/\r?\n/)) {
      const value = line.trim();
      if (!value) continue;
      try {
        out.push(JSON.parse(value));
      } catch {
        // ligne invalide ignorée
      }
    }
    return out;
  }
}

type CollectionName = "artists" | "albums" | "tracks" | "infos";

function collectionOf(filename: string): CollectionName | null {
  const base = (filename.split("/").pop() ?? filename)
    .split("\\")
    .pop()!
    .toLowerCase();
  if (base.endsWith(".metadata.json")) return null;
  const stem = base.replace(/\.(bson|json|jsonl)$/, "");
  const name = stem.replace(/[^a-z]/g, "");
  if (name === "artists" || name === "albums" || name === "tracks" || name === "infos") {
    return name;
  }
  return null;
}

/** Devine la collection à partir des clés du premier document. */
function collectionFromKeys(doc: Record<string, unknown>): CollectionName | null {
  if ("played_at" in doc || "playedAt" in doc) return "infos";
  if ("genres" in doc) return "artists";
  if ("duration_ms" in doc || "durationMs" in doc) return "tracks";
  if ("images" in doc) return "albums";
  return null;
}

/**
 * Détermine la collection d'un fichier isolé (non zippé) envoyé à l'API, où le
 * nom d'origine est perdu : d'abord via un nom fourni (`X-Filename`), sinon en
 * inspectant le premier document (BSON, puis JSON/JSONL).
 */
export function peekCollection(
  buffer: Uint8Array,
  filenameHint?: string | null,
): CollectionName | null {
  if (filenameHint) {
    const byName = collectionOf(filenameHint);
    if (byName) return byName;
  }
  // BSON : le premier document commence par sa taille (4 octets LE).
  if (buffer.length >= 5) {
    const size =
      buffer[0] | (buffer[1] << 8) | (buffer[2] << 16) | (buffer[3] << 24);
    if (size > 4 && size <= buffer.length) {
      try {
        return collectionFromKeys(
          deserialize(buffer.subarray(0, size)) as Record<string, unknown>,
        );
      } catch {
        // Pas du BSON : on tente le JSON ci-dessous.
      }
    }
  }
  // JSON/JSONL : on décode un début borné et on inspecte le premier objet.
  const head = new TextDecoder().decode(
    buffer.subarray(0, Math.min(buffer.length, 256 * 1024)),
  );
  for (const line of head.split(/\r?\n/)) {
    let value = line.trim();
    value = value.replace(/^\[/, "").replace(/^,/, "").trim();
    value = value.replace(/\]$/, "").replace(/,$/, "").trim();
    if (!value) continue;
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        return collectionFromKeys(parsed as Record<string, unknown>);
      }
    } catch {
      // Ligne tronquée ou invalide : on continue.
    }
  }
  return null;
}

export type YourSpotifyImport = {
  data: YourSpotifyData;
  counts: Record<CollectionName, number>;
  ignored: number;
};

/**
 * Construit les données Your Spotify à partir des fichiers d'un dump MongoDB
 * (fichiers `.bson`/`.json` individuellement, ou une archive `.zip`).
 */
export function buildYourSpotifyData(files: UploadedFile[]): YourSpotifyImport {
  const expanded: UploadedFile[] = [];
  for (const file of files) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      try {
        const entries = safeUnzip(file.data);
        for (const [path, bytes] of Object.entries(entries)) {
          if (!path.endsWith("/")) expanded.push({ name: path, data: bytes });
        }
      } catch {
        // archive illisible : ignorée
      }
    } else {
      expanded.push(file);
    }
  }

  const counts: Record<CollectionName, number> = {
    artists: 0,
    albums: 0,
    tracks: 0,
    infos: 0,
  };
  const collections: Record<CollectionName, unknown[]> = {
    artists: [],
    albums: [],
    tracks: [],
    infos: [],
  };
  const decoder = new TextDecoder();
  let ignored = 0;

  for (const file of expanded) {
    const collection = collectionOf(file.name);
    if (!collection) {
      ignored += 1;
      continue;
    }
    const documents = file.name.toLowerCase().endsWith(".bson")
      ? parseBsonDocuments(file.data)
      : parseJsonDocuments(decoder.decode(file.data));
    // Boucle plutôt que `push(...documents)` : un dump complet peut dépasser la
    // limite d'arguments de V8 (RangeError « Maximum call stack size »).
    for (const document of documents) collections[collection].push(document);
    counts[collection] += documents.length;
  }

  return {
    data: {
      artists: collections.artists as YourSpotifyArtist[],
      albums: collections.albums as YourSpotifyAlbum[],
      tracks: collections.tracks as YourSpotifyTrack[],
      infos: collections.infos as YourSpotifyInfo[],
    },
    counts,
    ignored,
  };
}
