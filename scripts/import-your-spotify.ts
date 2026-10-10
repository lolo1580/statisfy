/**
 * Import d'une base MongoDB *Your Spotify* vers Statisfy (SQLite).
 *
 *   MONGO_URL="mongodb://localhost:27017/your_spotify" \
 *     pnpm import:your-spotify --email vous@exemple.com
 *
 * Options :
 *   --mongo <url>   URL MongoDB (sinon variable MONGO_URL)
 *   --email <mail>  compte Statisfy cible (sinon le plus ancien compte)
 *   --limit <n>     ne traiter que les n premières écoutes (test)
 *
 * Le schéma de *Your Spotify* : collections `artists`, `albums`, `tracks`
 * (métadonnées) et `infos` (les écoutes). Le mapping est testable sans Mongo
 * via `src/lib/sources/your-spotify.ts`.
 */
import 'dotenv/config'
import { MongoClient } from 'mongodb'
import { prisma } from '../src/lib/db'
import { ingestPlays } from '../src/lib/sync/ingest'
import {
  mapYourSpotifyData,
  type YourSpotifyAlbum,
  type YourSpotifyArtist,
  type YourSpotifyInfo,
  type YourSpotifyTrack,
} from '../src/lib/sources/your-spotify'

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function main() {
  const mongoUrl = arg('mongo') ?? process.env.MONGO_URL
  const email = arg('email') ?? process.env.IMPORT_EMAIL
  const limit = Number(arg('limit')) || 0

  if (!mongoUrl) {
    throw new Error('Indiquez --mongo <url> ou la variable MONGO_URL.')
  }

  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!user) {
    throw new Error(
      'Aucun utilisateur Statisfy cible. Créez un compte ou passez --email.',
    )
  }

  const client = new MongoClient(mongoUrl)
  await client.connect()
  const db = client.db()

  const [artists, albums, tracks, allInfos] = await Promise.all([
    db.collection<YourSpotifyArtist>('artists').find({}).toArray(),
    db.collection<YourSpotifyAlbum>('albums').find({}).toArray(),
    db.collection<YourSpotifyTrack>('tracks').find({}).toArray(),
    db.collection<YourSpotifyInfo>('infos').find({}).toArray(),
  ])
  const infos = limit > 0 ? allInfos.slice(0, limit) : allInfos

  const { plays, skipped } = mapYourSpotifyData({
    artists,
    albums,
    tracks,
    infos,
  })

  console.log(
    `Your Spotify : ${artists.length} artistes, ${albums.length} albums, ` +
      `${tracks.length} titres, ${infos.length} écoutes (${skipped} ignorées).`,
  )

  const result = await ingestPlays(user.id, plays)
  console.log(
    `Import terminé pour ${user.email} : ${result.inserted} écoute(s) insérée(s) ` +
      `sur ${result.total} lue(s).`,
  )

  await client.close()
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
