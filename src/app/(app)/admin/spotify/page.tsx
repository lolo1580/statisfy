import { getCurrentUser } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { SpotifyRequests } from "@/components/spotify-requests";

export const dynamic = "force-dynamic";

/** Validation des demandes d'accès à l'API Spotify. */
export default async function AdminSpotifyPage() {
  const user = await getCurrentUser();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      spotifyAccessStatus: true,
      spotifyAccount: true,
      spotifyRequestedAt: true,
    },
  });

  // Accès Spotify des autres comptes (hors « none ») ; l'ordre est géré côté
  // client pour refléter immédiatement les changements de statut optimistes.
  const requests = users.filter(
    (member) => !member.isAdmin && member.spotifyAccessStatus !== "none",
  );

  return <SpotifyRequests requests={requests} timezone={user.timezone} />;
}
