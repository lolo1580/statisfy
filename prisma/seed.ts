/**
 * Script de démonstration / vérification.
 *
 *   pnpm db:seed
 *
 * Crée (ou réutilise) un compte de démo et insère un jeu de données d'écoute
 * réaliste afin de tester l'ingestion, les statistiques et le rendu du
 * tableau de bord sans dépendre de Spotify.
 */
import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { hashPassword } from '../src/lib/password'
import { ingestPlays } from '../src/lib/sync/ingest'
import { parseSpotifyHistory } from '../src/lib/sources/importer'
import { enrichMissingImages } from '../src/lib/sources/enrich'
import {
  getDailyStats,
  getOverview,
  getTopArtists,
  getTopGenres,
  getTopTracks,
} from '../src/lib/stats'
import { formatDuration } from '../src/lib/format'
import type { RawPlay } from '../src/lib/sources/types'

const DEMO_EMAIL = process.env.SEED_EMAIL ?? 'demo@statisfy.local'
const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'statisfy123'
const DEMO_TZ = 'Europe/Paris'

const CATALOG = [
  {
    artist: 'Daft Punk',
    genres: ['french house', 'electronic', 'electro'],
    tracks: ['One More Time', 'Harder, Better, Faster, Stronger', 'Around the World'],
    album: 'Discovery',
  },
  {
    artist: 'Bonobo',
    genres: ['downtempo', 'electronic', 'trip hop'],
    tracks: ['Kong', 'Kerala', 'Cirrus'],
    album: 'Black Sands',
  },
  {
    artist: 'Nujabes',
    genres: ['jazz rap', 'chillhop', 'hip hop'],
    tracks: ['Feather', 'Aruarian Dance', 'Luv(sic) Part 3'],
    album: 'Modal Soul',
  },
  {
    artist: 'Aphex Twin',
    genres: ['idm', 'electronic', 'ambient'],
    tracks: ['Windowlicker', 'Xtal', 'Avril 14th'],
    album: 'Selected Ambient Works',
  },
  {
    artist: 'Radiohead',
    genres: ['art rock', 'alternative rock', 'electronic'],
    tracks: ['Everything In Its Right Place', 'Weird Fishes', 'Pyramid Song'],
    album: 'Kid A',
  },
  {
    artist: 'Massive Attack',
    genres: ['trip hop', 'downtempo', 'electronic'],
    tracks: ['Teardrop', 'Angel', 'Unfinished Sympathy'],
    album: 'Mezzanine',
  },
]

function generatePlays(count = 750): RawPlay[] {
  const plays: RawPlay[] = []
  let seed = 42
  const random = () => {
    // Générateur congruentiel simple et déterministe.
    seed = (seed * 1103515245 + 12345) % 2 ** 31
    return seed / 2 ** 31
  }

  for (let i = 0; i < count; i += 1) {
    const entry = CATALOG[Math.floor(random() * CATALOG.length)]
    const trackName = entry.tracks[Math.floor(random() * entry.tracks.length)]
    const daysAgo = Math.floor(random() * 60)
    const playedAt = new Date(
      Date.now() -
        daysAgo * 24 * 60 * 60 * 1000 -
        Math.floor(random() * 20) * 60 * 60 * 1000,
    )
    plays.push({
      provider: 'spotify',
      externalArtistId: `seed-artist-${entry.artist.toLowerCase().replace(/\W+/g, '-')}`,
      externalTrackId: `seed-track-${entry.artist.toLowerCase().replace(/\W+/g, '-')}-${trackName.toLowerCase().replace(/\W+/g, '-')}`,
      trackName,
      artistName: entry.artist,
      albumName: entry.album,
      genres: entry.genres,
      durationMs: 180_000 + Math.floor(random() * 180_000),
      msPlayed: 150_000 + Math.floor(random() * 200_000),
      playedAt,
      context: 'seed',
    })
  }
  return plays
}

async function main() {
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      email: DEMO_EMAIL,
      name: 'Démo',
      passwordHash: await hashPassword(DEMO_PASSWORD),
      timezone: DEMO_TZ,
      isAdmin: true,
    },
  })
  console.log(`👤 Utilisateur : ${user.email}  (mot de passe : ${DEMO_PASSWORD})`)

  const existing = await prisma.play.count({ where: { userId: user.id } })
  if (existing === 0) {
    const result = await ingestPlays(user.id, generatePlays())
    console.log(
      `🎵 Ingestion : ${result.inserted} écoutes insérées (${result.skipped} ignorées).`,
    )
  } else {
    console.log(`🎵 ${existing} écoutes déjà présentes, ingestion ignorée.`)
  }

  // Les fichiers Spotify ne contiennent pas d'image : on complète via Deezer.
  const enriched = await enrichMissingImages(user.id, { max: 60 })
  console.log(
    `🖼️  Visuels : ${enriched.albumsUpdated}/${enriched.albumsChecked} album(s), ${enriched.artistsUpdated}/${enriched.artistsChecked} artiste(s).`,
  )

  // Vérifie le parseur d'export Spotify (format « Extended »).
  const parsed = parseSpotifyHistory(
    JSON.stringify([
      {
        ts: '2024-05-01T10:00:00Z',
        ms_played: 210_000,
        master_metadata_track_name: 'Exemple',
        master_metadata_album_artist_name: 'Artiste Test',
        master_metadata_album_album_name: 'Album Test',
        spotify_track_uri: 'spotify:track:exemple',
      },
    ]),
  )
  console.log(`🧪 Parseur Extended : ${parsed.length} écoute(s) reconnue(s).`)

  const [overview, artists, tracks, genres, daily] = await Promise.all([
    getOverview(user.id, { days: null }),
    getTopArtists(user.id, { days: null }, 3),
    getTopTracks(user.id, { days: null }, 3),
    getTopGenres(user.id, { days: null }, 5),
    getDailyStats(user.id, DEMO_TZ, { days: 30 }),
  ])

  console.log('\n📊 Statistiques')
  console.log(`   Temps d'écoute : ${formatDuration(overview.totalMs)}`)
  console.log(`   Écoutes        : ${overview.totalPlays}`)
  console.log(`   Artistes       : ${overview.distinctArtists}`)
  console.log(`   Top artistes   : ${artists.map((a) => `${a.name} (${a.plays})`).join(', ')}`)
  console.log(`   Top titres     : ${tracks.map((t) => `${t.name} (${t.plays})`).join(', ')}`)
  console.log(`   Top genres     : ${genres.map((g) => `${g.genre} (${g.plays})`).join(', ')}`)
  console.log(`   Jours agrégés  : ${daily.length}`)

  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
