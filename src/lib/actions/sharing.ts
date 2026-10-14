"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { getCurrentUser } from "../auth/dal";
import { randomToken } from "../crypto";

/** Génère un jeton de partage unique (collision quasi impossible). */
async function generateShareToken(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = randomToken(24);
    const existing = await prisma.user.findFirst({
      where: { wrappedShareToken: token },
      select: { id: true },
    });
    if (!existing) return token;
  }
  throw new Error("Impossible de générer un jeton de partage.");
}

/** Active (ou régénère) le partage public du récapitulatif. */
export async function enableWrappedShare(): Promise<void> {
  const user = await getCurrentUser();
  const token = await generateShareToken();
  await prisma.user.update({
    where: { id: user.id },
    data: { wrappedShareToken: token },
  });
  revalidatePath("/settings/data");
}

/** Désactive le partage public du récapitulatif. */
export async function disableWrappedShare(): Promise<void> {
  const user = await getCurrentUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { wrappedShareToken: null },
  });
  revalidatePath("/settings/data");
}
