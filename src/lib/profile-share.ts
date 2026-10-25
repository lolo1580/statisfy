import "server-only";

import { prisma } from "./db";

/**
 * Partage public (opt-in) du profil « live ».
 *
 * Le jeton est stocké sur `User.profileShareToken` ; sa présence active le
 * partage. `profileShareConfig` est un JSON qui choisit les sections exposées
 * (les valeurs manquantes reprennent les défauts).
 */

export type ProfileShareConfig = {
  topArtists: boolean;
  topTracks: boolean;
  recentPlays: boolean;
  heatmap: boolean;
};

export const DEFAULT_PROFILE_SHARE_CONFIG: ProfileShareConfig = {
  topArtists: true,
  topTracks: true,
  recentPlays: false,
  heatmap: true,
};

/** Parse défensif : toute valeur absente ou invalide retombe sur le défaut. */
export function parseProfileShareConfig(
  raw: string | null | undefined,
): ProfileShareConfig {
  if (!raw) return { ...DEFAULT_PROFILE_SHARE_CONFIG };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_PROFILE_SHARE_CONFIG };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ...DEFAULT_PROFILE_SHARE_CONFIG };
  }
  const value = parsed as Record<string, unknown>;
  const read = (key: keyof ProfileShareConfig): boolean =>
    typeof value[key] === "boolean"
      ? (value[key] as boolean)
      : DEFAULT_PROFILE_SHARE_CONFIG[key];
  return {
    topArtists: read("topArtists"),
    topTracks: read("topTracks"),
    recentPlays: read("recentPlays"),
    heatmap: read("heatmap"),
  };
}

export function serializeProfileShareConfig(
  config: ProfileShareConfig,
): string {
  return JSON.stringify(config);
}

/** Jeton et configuration d'un compte (`token: null` = partage désactivé). */
export async function getProfileShare(
  userId: string,
): Promise<{ token: string | null; config: ProfileShareConfig }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profileShareToken: true, profileShareConfig: true },
  });
  return {
    token: user?.profileShareToken ?? null,
    config: parseProfileShareConfig(user?.profileShareConfig),
  };
}

/** Propriétaire d'un jeton public, avec la configuration exposée. */
export async function getSharedProfile(
  token: string | null | undefined,
): Promise<{
  id: string;
  name: string;
  timezone: string;
  config: ProfileShareConfig;
} | null> {
  if (!token) return null;
  const user = await prisma.user.findFirst({
    where: { profileShareToken: token },
    select: {
      id: true,
      name: true,
      timezone: true,
      profileShareConfig: true,
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    timezone: user.timezone,
    config: parseProfileShareConfig(user.profileShareConfig),
  };
}
