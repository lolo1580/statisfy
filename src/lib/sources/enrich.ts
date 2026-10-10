import "server-only";

import { prisma } from "../db";
import { spotify } from "../env";

/**
 * Enrichissement des pochettes et photos d'artistes manquantes.
 *
 * Les imports de fichiers Spotify ne contiennent aucune image. On complète donc
 * les entités manquantes via le **catalogue Spotify** (flux
 * `client_credentials`, sans compte utilisateur), en recherchant par
 * artiste/album.
 */

const ACCOUNTS = "https://accounts.spotify.com";
const API = "https://api.spotify.com/v1";

type SpotifyImage = { url?: string };
type SpotifySearchResponse = {
  albums?: { items?: Array<{ images?: SpotifyImage[] }> };
  artists?: { items?: Array<{ images?: SpotifyImage[] }> };
};

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getClientToken(): Promise<string> {
  if (!spotify.configured) {
    throw new Error(
      "SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET non configurés sur le serveur.",
    );
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const basic = Buffer.from(
    `${spotify.clientId}:${spotify.clientSecret}`,
  ).toString("base64");
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!res.ok) {
    throw new Error(`Jeton Spotify refusé (${res.status}).`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.value;
}

async function searchImage(
  token: string,
  type: "album" | "artist",
  query: string,
): Promise<string | null> {
  const url = new URL(`${API}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("type", type);
  url.searchParams.set("limit", "1");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as SpotifySearchResponse;
  const item = type === "album" ? data.albums?.items?.[0] : data.artists?.items?.[0];
  return item?.images?.[0]?.url ?? null;
}

/** Recherche la pochette d'un album dans le catalogue Spotify. */
export async function findAlbumCover(
  artistName: string,
  albumName: string,
): Promise<string | null> {
  const token = await getClientToken();
  return searchImage(token, "album", `artist:"${artistName}" album:"${albumName}"`);
}

/** Recherche la photo d'un artiste dans le catalogue Spotify. */
export async function findArtistPicture(name: string): Promise<string | null> {
  const token = await getClientToken();
  return searchImage(token, "artist", `artist:"${name}"`);
}

export type EnrichResult = {
  artistsChecked: number;
  artistsUpdated: number;
  albumsChecked: number;
  albumsUpdated: number;
};

/**
 * Complète les images manquantes des artistes et albums écoutés par
 * l'utilisateur. Les appels sont séquentiels et espacés pour respecter les
 * limites de l'API Spotify.
 */
export async function enrichMissingImages(
  userId: string,
  options: { max?: number; delayMs?: number } = {},
): Promise<EnrichResult> {
  const max = options.max ?? 100;
  const delayMs = options.delayMs ?? 120;

  const [artists, albums] = await Promise.all([
    prisma.artist.findMany({
      where: { imageUrl: null, plays: { some: { userId } } },
      orderBy: { name: "asc" },
      take: max,
    }),
    prisma.album.findMany({
      where: { imageUrl: null, plays: { some: { userId } } },
      orderBy: { name: "asc" },
      take: max,
      include: { artist: { select: { name: true } } },
    }),
  ]);

  let artistsUpdated = 0;
  for (const artist of artists) {
    const url = await findArtistPicture(artist.name);
    if (url) {
      await prisma.artist.update({
        where: { id: artist.id },
        data: { imageUrl: url },
      });
      artistsUpdated += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  let albumsUpdated = 0;
  for (const album of albums) {
    const url = await findAlbumCover(album.artist.name, album.name);
    if (url) {
      await prisma.album.update({
        where: { id: album.id },
        data: { imageUrl: url },
      });
      albumsUpdated += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return {
    artistsChecked: artists.length,
    artistsUpdated,
    albumsChecked: albums.length,
    albumsUpdated,
  };
}
