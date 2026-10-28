import "server-only";

import { safeUnzip } from "../archive";
import type { RawPlay } from "./types";

export type HistoryFile = { name: string; data: Uint8Array };

export type HistoryParseResult = {
  plays: RawPlay[];
  /** Nombre de fichiers d'historique effectivement exploités. */
  files: number;
};

/**
 * Analyse un lot de fichiers de l'export de données Spotify.
 *
 * Accepte les `.json` (ou JSONL) ainsi que l'archive `.zip` livrée par Spotify
 * (« Extended streaming history »), qui contient plusieurs fichiers
 * `Streaming_History_Audio_*.json`.
 */
export function parseSpotifyHistoryFiles(
  files: HistoryFile[],
): HistoryParseResult {
  const plays: RawPlay[] = [];
  let parsed = 0;

  const collect = (name: string, data: Uint8Array): void => {
    const rows = parseSpotifyHistory(decode(data));
    if (rows.length > 0) {
      // Boucle plutôt que `push(...rows)` : un gros fichier peut dépasser la
      // limite d'arguments de V8 (RangeError « Maximum call stack size »).
      for (const row of rows) plays.push(row);
      parsed += 1;
    }
  };

  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".zip")) {
      try {
        const entries = safeUnzip(file.data);
        for (const [path, bytes] of Object.entries(entries)) {
          if (path.endsWith("/")) continue;
          if (!path.toLowerCase().endsWith(".json")) continue;
          collect(path, bytes);
        }
      } catch {
        // archive illisible : ignorée
      }
      continue;
    }
    if (lower.endsWith(".json") || lower.endsWith(".jsonl")) {
      collect(file.name, file.data);
    }
  }

  return { plays, files: parsed };
}

function decode(data: Uint8Array): string {
  return new TextDecoder().decode(data);
}

/**
 * Analyse un export de données Spotify.
 *
 * Deux formats sont reconnus automatiquement :
 * - « Extended streaming history » : `Streaming_History_Audio_*.json`
 *   (champ `ts`, `ms_played`, `master_metadata_track_name`, ...)
 * - « Privacy data » classique : `StreamingHistory*.json`
 *   (champ `endTime`, `artistName`, `trackName`, `msPlayed`)
 *
 * Les fichiers JSONL (un objet par ligne) sont également acceptés.
 */
export function parseSpotifyHistory(text: string): RawPlay[] {
  const rows = parseRows(text);
  const plays: RawPlay[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;

    const isExtended =
      "master_metadata_track_name" in record ||
      "ts" in record ||
      "spotify_track_uri" in record;

    const trackName = firstString(
      isExtended ? record.master_metadata_track_name : record.trackName,
    );
    const artistName = firstString(
      isExtended ? record.master_metadata_album_artist_name : record.artistName,
    );
    const albumName = firstString(
      isExtended ? record.master_metadata_album_album_name : record.albumName,
    );
    const rawDate = firstString(isExtended ? record.ts : record.endTime);
    const msPlayed = firstNumber(
      isExtended ? record.ms_played : record.msPlayed,
    );

    if (!trackName || !artistName || !rawDate) continue;
    const playedAt = parseDate(rawDate);
    if (!playedAt) continue;

    const uri = firstString(record.spotify_track_uri);
    const externalTrackId = uri?.startsWith("spotify:track:")
      ? uri.split(":").pop() || undefined
      : undefined;

    // Métadonnées de comportement : présentes uniquement dans l'export étendu.
    const platform = isExtended ? firstString(record.platform) : undefined;
    const country = isExtended ? firstString(record.conn_country) : undefined;
    const skipped = isExtended ? firstBoolean(record.skipped) : undefined;
    const shuffle = isExtended ? firstBoolean(record.shuffle) : undefined;
    const offline = isExtended ? firstBoolean(record.offline) : undefined;
    const incognito = isExtended
      ? firstBoolean(record.incognito_mode)
      : undefined;
    const reasonStart = isExtended
      ? firstString(record.reason_start)
      : undefined;
    const reasonEnd = isExtended ? firstString(record.reason_end) : undefined;

    plays.push({
      provider: "spotify",
      origin: "import",
      externalTrackId,
      trackName,
      artistName,
      albumName,
      playedAt,
      msPlayed: msPlayed ?? undefined,
      context: "import",
      platform,
      country,
      skipped,
      shuffle,
      offline,
      incognito,
      reasonStart,
      reasonEnd,
    });
  }

  return plays;
}

function parseRows(text: string): unknown[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // Tentative JSONL : un objet JSON par ligne.
    const out: unknown[] = [];
    for (const line of trimmed.split(/\r?\n/)) {
      const l = line.trim();
      if (!l) continue;
      try {
        out.push(JSON.parse(l));
      } catch {
        // ligne invalide ignorée
      }
    }
    return out;
  }
}

function parseDate(value: string): Date | null {
  let normalized = value.trim();
  // « 2023-06-01 14:23 » (ancien format) -> « 2023-06-01T14:23 ».
  if (!normalized.includes("T") && normalized.includes(" ")) {
    normalized = normalized.replace(" ", "T");
  }
  // Sans fuseau explicite, Spotify exporte des horodatages **UTC** : `new Date`
  // les interpréterait sinon comme l'heure locale du serveur (décalage +1/+2 h).
  if (
    !/(Z|[+-]\d{2}:?\d{2})$/.test(normalized) &&
    /\d{2}:\d{2}/.test(normalized)
  ) {
    normalized += "Z";
  }
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function firstString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function firstNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function firstBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}
