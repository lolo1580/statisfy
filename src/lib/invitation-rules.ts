import crypto from "node:crypto";

/**
 * Règles pures des invitations (sans accès base), pour rester testables.
 */

/** Durée de validité par défaut d'une invitation (jours). */
export const INVITATION_TTL_DAYS = 7;

/** Borne haute défensive (une invitation ne peut pas être quasi éternelle). */
export const MAX_INVITATION_TTL_DAYS = 365;

/** Durées proposées dans l'interface d'administration. */
export const INVITATION_TTL_CHOICES = [1, 7, 30];

/** Génère un jeton d'invitation opaque, sûr pour une URL. */
export function generateInvitationToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/** Date d'expiration d'une invitation créée maintenant, selon un nombre de jours. */
export function invitationExpiry(days?: number, now = new Date()): Date {
  const safe =
    typeof days === "number" && Number.isFinite(days) && days >= 1
      ? Math.min(Math.floor(days), MAX_INVITATION_TTL_DAYS)
      : INVITATION_TTL_DAYS;
  return new Date(now.getTime() + safe * 24 * 60 * 60 * 1000);
}

/**
 * Une invitation est utilisable si elle n'a pas encore été consommée et si sa
 * date d'expiration est dans le futur.
 */
export function isInvitationUsable(
  invitation: { usedAt: Date | null; expiresAt: Date },
  now = new Date(),
): boolean {
  return !invitation.usedAt && invitation.expiresAt.getTime() > now.getTime();
}
