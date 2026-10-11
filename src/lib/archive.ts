import { unzipSync, type UnzipFileInfo } from "fflate";

/**
 * Décompression d'archive avec plafonds anti « zip bomb » : on refuse les
 * entrées trop volumineuses et on borne la taille décompressée cumulée.
 * Les entrées filtrées ne sont pas gonflées en mémoire.
 */
export const MAX_ENTRY_BYTES = 256 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 512 * 1024 * 1024;

export type UnzipLimits = {
  maxEntryBytes?: number;
  maxTotalBytes?: number;
};

export function safeUnzip(
  data: Uint8Array,
  limits: UnzipLimits = {},
): Record<string, Uint8Array> {
  const maxEntry = limits.maxEntryBytes ?? MAX_ENTRY_BYTES;
  const maxTotal = limits.maxTotalBytes ?? MAX_TOTAL_BYTES;
  let total = 0;
  return unzipSync(data, {
    filter: (file: UnzipFileInfo) => {
      if (file.originalSize > maxEntry) return false;
      total += file.originalSize;
      return total <= maxTotal;
    },
  });
}
