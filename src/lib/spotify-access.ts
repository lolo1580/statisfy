import "server-only";

import { prisma } from "./db";
import {
  isSpotifyAccessGranted,
  SPOTIFY_ACCESS_NONE,
} from "./spotify-access-rules";

export {
  SPOTIFY_ACCESS_APPROVED,
  SPOTIFY_ACCESS_NONE,
  SPOTIFY_ACCESS_PENDING,
  SPOTIFY_ACCESS_REJECTED,
} from "./spotify-access-rules";
export type { SpotifyAccessStatus } from "./spotify-access-rules";

/**
 * Gestion des accès à l'API Spotify.
 *
 * Spotify, en mode *Development*, limite l'application à une liste de comptes
 * autorisés : un utilisateur doit donc demander l'accès, puis un administrateur
 * l'approuve après l'avoir ajouté dans le tableau de bord Spotify.
 */

export type SpotifyAccess = {
  status: string;
  account: string | null;
  requestedAt: Date | null;
  decidedAt: Date | null;
};

export async function getSpotifyAccess(userId: string): Promise<SpotifyAccess> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      spotifyAccessStatus: true,
      spotifyAccount: true,
      spotifyRequestedAt: true,
      spotifyDecidedAt: true,
    },
  });
  return {
    status: user?.spotifyAccessStatus ?? SPOTIFY_ACCESS_NONE,
    account: user?.spotifyAccount ?? null,
    requestedAt: user?.spotifyRequestedAt ?? null,
    decidedAt: user?.spotifyDecidedAt ?? null,
  };
}

/** L'utilisateur peut-il connecter son compte Spotify ? */
export async function canConnectSpotify(user: {
  id: string;
  isAdmin: boolean;
}): Promise<boolean> {
  if (user.isAdmin) return true;

  const [access, existing] = await Promise.all([
    getSpotifyAccess(user.id),
    prisma.sourceConnection.findFirst({
      where: { userId: user.id, type: "spotify" },
      select: { id: true },
    }),
  ]);

  return isSpotifyAccessGranted({
    isAdmin: false,
    status: access.status,
    hasConnection: Boolean(existing),
  });
}
