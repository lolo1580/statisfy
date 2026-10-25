import { csvCell } from "./csv";

/** En-tête du CSV d'historique (stable : les nouvelles colonnes s'ajoutent à la fin). */
export const CSV_HEADER =
  "played_at,ms_played,track,artist,album,source,context,platform,country,skipped,shuffle,offline,incognito,reason_start,reason_end\n";

/** Écoute minimale nécessaire à une ligne CSV. */
export type CsvPlay = {
  playedAt: Date;
  msPlayed: number;
  source: string;
  context: string | null;
  platform: string | null;
  country: string | null;
  skipped: boolean | null;
  shuffle: boolean | null;
  offline: boolean | null;
  incognito: boolean | null;
  reasonStart: string | null;
  reasonEnd: string | null;
  track: {
    name: string;
    artist: { name: string };
    album: { name: string } | null;
  };
};

function boolCell(value: boolean | null): string {
  if (value === null) return "";
  return value ? "true" : "false";
}

/** Une ligne CSV (terminée par `\n`), métadonnées d'export étendu incluses. */
export function playToCsvRow(play: CsvPlay): string {
  return (
    [
      play.playedAt.toISOString(),
      play.msPlayed,
      play.track.name,
      play.track.artist.name,
      play.track.album?.name ?? "",
      play.source,
      play.context,
      play.platform,
      play.country,
      boolCell(play.skipped),
      boolCell(play.shuffle),
      boolCell(play.offline),
      boolCell(play.incognito),
      play.reasonStart,
      play.reasonEnd,
    ]
      .map(csvCell)
      .join(",") + "\n"
  );
}
