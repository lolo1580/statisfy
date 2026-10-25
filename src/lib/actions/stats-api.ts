"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { getCurrentUser } from "../auth/dal";
import { randomToken } from "../crypto";

/**
 * API de statistiques : activation, régénération et révocation du jeton.
 * Même modèle que le partage du récapitulatif (`wrappedShareToken`) : le jeton
 * est opaque, propre au compte, et sa suppression désactive immédiatement
 * l'accès.
 */

/** Génère un jeton unique (collision quasi impossible, mais on vérifie). */
async function generateStatsApiToken(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = randomToken(24);
    const existing = await prisma.user.findFirst({
      where: { statsApiToken: token },
      select: { id: true },
    });
    if (!existing) return token;
  }
  throw new Error("Impossible de générer un jeton d'API.");
}

/** Active l'API (ou régénère le jeton, ce qui invalide l'ancien). */
export async function enableStatsApi(): Promise<void> {
  const user = await getCurrentUser();
  const token = await generateStatsApiToken();
  await prisma.user.update({
    where: { id: user.id },
    data: { statsApiToken: token },
  });
  revalidatePath("/settings/data");
}

/** Désactive l'API et invalide le jeton courant. */
export async function disableStatsApi(): Promise<void> {
  const user = await getCurrentUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { statsApiToken: null },
  });
  revalidatePath("/settings/data");
}
