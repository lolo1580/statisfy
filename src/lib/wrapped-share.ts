import "server-only";

import { prisma } from "./db";

/**
 * Partage public (opt-in) du récapitulatif.
 *
 * Le jeton est stocké sur `User.wrappedShareToken` ; sa présence active le
 * partage, sa suppression le désactive. Le jeton est opaque et non devinable.
 */

/** Identifiant de l'utilisateur propriétaire d'un jeton de partage. */
export async function getSharedUserId(
  token: string | null | undefined,
): Promise<string | null> {
  if (!token) return null;
  const user = await prisma.user.findFirst({
    where: { wrappedShareToken: token },
    select: { id: true },
  });
  return user?.id ?? null;
}

/** Jeton de partage actuel d'un utilisateur (`null` si désactivé). */
export async function getWrappedShareToken(
  userId: string,
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { wrappedShareToken: true },
  });
  return user?.wrappedShareToken ?? null;
}
