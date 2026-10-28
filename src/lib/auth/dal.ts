import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { readSession } from "./session";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  timezone: string;
  isAdmin: boolean;
};

/**
 * Vérifie la session et renvoie l'utilisateur courant.
 * Redirige vers /login si non authentifié. Mémoïsé par requête.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const session = await readSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    select: {
      id: true,
      email: true,
      name: true,
      timezone: true,
      isAdmin: true,
    },
  });
  if (!user) redirect("/login");
  return user;
});

/** Variante non redirigeante, utile pour les Route Handlers. */
export async function getOptionalUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.uid },
    select: {
      id: true,
      email: true,
      name: true,
      timezone: true,
      isAdmin: true,
    },
  });
}

/**
 * Renvoie l'utilisateur courant **uniquement s'il est administrateur**
 * (`null` sinon). Centralise le contrôle de rôle côté serveur : les actions
 * réservées à l'administration doivent passer par ce helper plutôt que de
 * répéter `if (!user.isAdmin)`.
 */
export async function getAdminUser(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return user.isAdmin ? user : null;
}

/**
 * Variante non redirigeante pour les Route Handlers : renvoie l'utilisateur
 * seulement s'il est connecté **et** administrateur (`null` sinon).
 */
export async function getOptionalAdmin(): Promise<CurrentUser | null> {
  const user = await getOptionalUser();
  return user?.isAdmin ? user : null;
}
