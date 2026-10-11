"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { getCurrentUser } from "../auth/dal";
import {
  SPOTIFY_ACCESS_APPROVED,
  SPOTIFY_ACCESS_NONE,
  SPOTIFY_ACCESS_PENDING,
  SPOTIFY_ACCESS_REJECTED,
} from "../spotify-access";
import { clientIp, takeToken } from "../auth/rate-limit";
import { getI18n } from "@/i18n/server";

export type SpotifyAccessState =
  | { ok?: boolean; error?: string; message?: string }
  | undefined;

/** L'utilisateur demande l'accès à l'API Spotify, en précisant son compte. */
export async function requestSpotifyAccess(
  _state: SpotifyAccessState,
  formData: FormData,
): Promise<SpotifyAccessState> {
  const { t } = await getI18n();
  const user = await getCurrentUser();

  // Anti-abus : limite les demandes répétées d'un même compte.
  const ip = await clientIp();
  if (!takeToken(`spotify-request:${user.id}:${ip}`, 20, 60 * 60 * 1000)) {
    return { error: t("autherr.rateLimited", { minutes: 60 }) };
  }

  const account = String(formData.get("account") ?? "")
    .trim()
    .slice(0, 200);
  if (!account) return { error: t("err.spotifyAccountRequired") };

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { spotifyAccessStatus: true },
  });
  // Un compte déjà approuvé (ou un administrateur) ne redescend pas en attente.
  const approved =
    user.isAdmin || current?.spotifyAccessStatus === SPOTIFY_ACCESS_APPROVED;

  const now = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      spotifyAccessStatus: approved
        ? SPOTIFY_ACCESS_APPROVED
        : SPOTIFY_ACCESS_PENDING,
      spotifyAccount: account,
      spotifyRequestedAt: now,
      ...(approved ? {} : { spotifyDecidedAt: null }),
    },
  });

  revalidatePath("/settings");
  return { ok: true, message: t("msg.spotifyRequested") };
}

/** Un administrateur approuve une demande d'accès Spotify. */
export async function approveSpotifyAccess(formData: FormData): Promise<void> {
  const admin = await getCurrentUser();
  if (!admin.isAdmin) return;

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      spotifyAccessStatus: SPOTIFY_ACCESS_APPROVED,
      spotifyDecidedAt: new Date(),
    },
  });
  revalidatePath("/settings");
}

/** Un administrateur refuse une demande d'accès Spotify. */
export async function rejectSpotifyAccess(formData: FormData): Promise<void> {
  const admin = await getCurrentUser();
  if (!admin.isAdmin) return;

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      spotifyAccessStatus: SPOTIFY_ACCESS_REJECTED,
      spotifyDecidedAt: new Date(),
    },
  });
  revalidatePath("/settings");
}

/**
 * Un administrateur révoque un accès Spotify déjà approuvé : la connexion
 * (et ses jetons) est supprimée et l'utilisateur devra refaire une demande.
 */
export async function revokeSpotifyAccess(formData: FormData): Promise<void> {
  const admin = await getCurrentUser();
  if (!admin.isAdmin) return;

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      spotifyAccessStatus: SPOTIFY_ACCESS_NONE,
      spotifyDecidedAt: new Date(),
    },
  });
  await prisma.sourceConnection.deleteMany({
    where: { userId, type: "spotify" },
  });
  revalidatePath("/settings");
}

/** L'utilisateur annule sa propre demande d'accès encore en attente. */
export async function cancelSpotifyRequest(): Promise<void> {
  const user = await getCurrentUser();
  await prisma.user.updateMany({
    where: { id: user.id, spotifyAccessStatus: SPOTIFY_ACCESS_PENDING },
    data: { spotifyAccessStatus: SPOTIFY_ACCESS_NONE, spotifyDecidedAt: null },
  });
  revalidatePath("/settings");
}
