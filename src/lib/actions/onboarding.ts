"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { getCurrentUser } from "../auth/dal";

/**
 * Marque l'accueil (didacticiel) comme vu : il ne s'affichera plus.
 * Réservé à l'utilisateur connecté (n'importe quel rôle).
 */
export async function completeOnboarding(): Promise<void> {
  const user = await getCurrentUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { onboardedAt: new Date() },
  });
  revalidatePath("/dashboard");
}

/** Masque la checklist « Bien démarrer » sur le tableau de bord. */
export async function dismissChecklist(): Promise<void> {
  const user = await getCurrentUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { checklistHiddenAt: new Date() },
  });
  revalidatePath("/dashboard");
}
