import "server-only";

import { prisma } from "./db";
import {
  generateInvitationToken,
  invitationExpiry,
  isInvitationUsable,
} from "./invitation-rules";

export type Invitation = Awaited<ReturnType<typeof prisma.invitation.create>>;

/** Crée une invitation (adresse cible facultative, durée en jours). */
export async function createInvitation(params: {
  createdById: string;
  email?: string | null;
  days?: number;
}): Promise<Invitation> {
  const email = params.email?.trim().toLowerCase() || null;
  return prisma.invitation.create({
    data: {
      token: generateInvitationToken(),
      email,
      createdById: params.createdById,
      expiresAt: invitationExpiry(params.days),
    },
  });
}

/** Renvoie une invitation utilisable à partir de son jeton, sinon `null`. */
export async function findUsableInvitation(
  token: string | null | undefined,
): Promise<Invitation | null> {
  if (!token) return null;
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation || !isInvitationUsable(invitation)) return null;
  return invitation;
}

/** Supprime les invitations consommées ou expirées (nettoyage). */
export async function purgeInvitations(now = new Date()): Promise<number> {
  const result = await prisma.invitation.deleteMany({
    where: { OR: [{ usedAt: { not: null } }, { expiresAt: { lt: now } }] },
  });
  return result.count;
}

/** Liste toutes les invitations (récentes d'abord) pour l'admin. */
export async function listInvitations(): Promise<Invitation[]> {
  return prisma.invitation.findMany({ orderBy: { createdAt: "desc" } });
}

/** Supprime une invitation (révocation). */
export async function deleteInvitation(id: string): Promise<void> {
  await prisma.invitation.deleteMany({ where: { id } });
}
