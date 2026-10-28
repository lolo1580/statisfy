import "server-only";

import crypto from "node:crypto";
import { syncToken } from "../env";

/**
 * Comparaison de chaînes en temps constant : évite les attaques temporelles
 * lors de la vérification d'un jeton ou d'un secret.
 */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Vérifie un en-tête `Authorization: Bearer <SYNC_TOKEN>`.
 * Renvoie `false` tant qu'aucun jeton n'est configuré — le jeton global reste
 * donc inactif par défaut.
 */
export function hasValidSyncToken(
  authorization: string | null | undefined,
): boolean {
  if (syncToken.length === 0) return false;
  const provided = authorization?.replace(/^Bearer\s+/i, "") ?? "";
  return safeEqual(provided, syncToken);
}
