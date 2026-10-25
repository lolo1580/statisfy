"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { getCurrentUser } from "../auth/dal";
import { randomToken } from "../crypto";
import {
  DEFAULT_PROFILE_SHARE_CONFIG,
  parseProfileShareConfig,
  serializeProfileShareConfig,
} from "../profile-share";

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

/** Génère un jeton de profil unique (collision quasi impossible). */
async function generateProfileShareToken(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = randomToken(24);
    const existing = await prisma.user.findFirst({
      where: { profileShareToken: token },
      select: { id: true },
    });
    if (!existing) return token;
  }
  throw new Error("Impossible de générer un jeton de partage.");
}

/** Active (ou régénère) le partage public du profil. */
export async function enableProfileShare(): Promise<void> {
  const user = await getCurrentUser();
  const token = await generateProfileShareToken();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      profileShareToken: token,
      profileShareConfig: serializeProfileShareConfig(
        DEFAULT_PROFILE_SHARE_CONFIG,
      ),
    },
  });
  revalidatePath("/settings/data");
}

/** Désactive le partage public du profil. */
export async function disableProfileShare(): Promise<void> {
  const user = await getCurrentUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { profileShareToken: null, profileShareConfig: null },
  });
  revalidatePath("/settings/data");
}

/** Met à jour les sections exposées publiquement (cases à cocher). */
export async function updateProfileShareConfig(
  formData: FormData,
): Promise<void> {
  const user = await getCurrentUser();
  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { profileShareToken: true, profileShareConfig: true },
  });
  if (!current?.profileShareToken) return;

  const previous = parseProfileShareConfig(current.profileShareConfig);
  const config = {
    topArtists: formData.get("topArtists") === "on",
    topTracks: formData.get("topTracks") === "on",
    recentPlays: formData.get("recentPlays") === "on",
    heatmap: formData.get("heatmap") === "on",
  };
  // Aucune section : on garde la configuration précédente plutôt que d'exposer
  // une page vide par erreur de manipulation.
  const hasAny = Object.values(config).some(Boolean);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      profileShareConfig: serializeProfileShareConfig(
        hasAny ? config : previous,
      ),
    },
  });
  revalidatePath("/settings/data");
}
