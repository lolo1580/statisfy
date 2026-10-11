import crypto from "node:crypto";

/**
 * Génération de mots de passe temporaires (réinitialisation par un admin).
 * Module pur (pas de dépendance Next) pour rester testable.
 */

// Alphabet sans caractères ambigus (I, l, O, 0, 1).
const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export const TEMP_PASSWORD_LENGTH = 12;

/** Mot de passe temporaire aléatoire (crypto), lisible par un humain. */
export function generateTemporaryPassword(
  length = TEMP_PASSWORD_LENGTH,
): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += PASSWORD_ALPHABET[crypto.randomInt(PASSWORD_ALPHABET.length)];
  }
  return out;
}
