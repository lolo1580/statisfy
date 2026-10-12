/**
 * Migration des données : SQLite → PostgreSQL.
 *
 *   pnpm migrate:sqlite                 # lit prisma/dev.db
 *   pnpm migrate:sqlite -- --sqlite /chemin/vers/dev.db
 *   pnpm migrate:sqlite -- --dry-run    # n'écrit rien, affiche les volumes
 *
 * Lit l'ancienne base SQLite en lecture seule (`node:sqlite`, sans dépendance)
 * et copie les lignes telles quelles dans PostgreSQL, **en conservant les
 * identifiants** et dans l'ordre des clés étrangères. L'opération est
 * **idempotente** (`createMany … skipDuplicates`) : la relancer ne crée pas de
 * doublon. Les identifiants de sources chiffrés sont copiés tels quels (même
 * `CREDENTIALS_KEY`).
 */
import 'dotenv/config'

import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { prisma } from '../src/lib/db'

/** Colonnes `DateTime` (stockées en TEXT ISO8601 par l'ancien client SQLite). */
const DATE_FIELDS: Record<string, string[]> = {
  User: ['createdAt', 'updatedAt', 'spotifyRequestedAt', 'spotifyDecidedAt'],
  Session: ['expiresAt', 'createdAt'],
  SourceConnection: ['lastSyncedAt', 'lastPlayAt', 'createdAt', 'updatedAt'],
  Play: ['playedAt', 'createdAt'],
  Job: ['createdAt', 'startedAt', 'finishedAt'],
  Invitation: ['expiresAt', 'usedAt', 'createdAt'],
  AppSetting: ['updatedAt'],
}

/** Colonnes `Boolean` (stockées en 0/1 par SQLite). */
const BOOL_FIELDS: Record<string, string[]> = {
  User: ['isAdmin'],
}

/** Ordre de copie respectant les clés étrangères. */
const TABLES: Array<{ table: string; model: string }> = [
  { table: 'User', model: 'user' },
  { table: 'Artist', model: 'artist' },
  { table: 'Album', model: 'album' },
  { table: 'Track', model: 'track' },
  { table: 'SourceConnection', model: 'sourceConnection' },
  { table: 'Session', model: 'session' },
  { table: 'ExternalRef', model: 'externalRef' },
  { table: 'Play', model: 'play' },
  { table: 'Job', model: 'job' },
  { table: 'Invitation', model: 'invitation' },
  { table: 'AppSetting', model: 'appSetting' },
]

const CHUNK_SIZE = 500

type Row = Record<string, unknown>

function convert(table: string, row: Row): Row {
  const out: Row = { ...row }
  for (const field of DATE_FIELDS[table] ?? []) {
    const value = out[field]
    out[field] = value == null ? null : new Date(value as string)
  }
  for (const field of BOOL_FIELDS[table] ?? []) {
    const value = out[field]
    out[field] = value == null ? null : Boolean(value)
  }
  return out
}

function parseArgs(argv: string[]) {
  let sqlite = process.env.SQLITE_PATH ?? path.join('prisma', 'dev.db')
  let dryRun = false
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--sqlite') sqlite = argv[i + 1] ?? sqlite
    else if (argv[i] === '--dry-run') dryRun = true
  }
  return { sqlite, dryRun }
}

async function main() {
  const { sqlite, dryRun } = parseArgs(process.argv.slice(2))

  if (!fs.existsSync(sqlite)) {
    throw new Error(`Base SQLite introuvable : ${sqlite}`)
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL est manquant (cible PostgreSQL).')
  }

  console.log(`Source SQLite : ${sqlite}`)
  console.log(`Cible         : PostgreSQL${dryRun ? ' (dry-run)' : ''}`)
  console.log('')

  const db = new DatabaseSync(sqlite, { readOnly: true })
  let totalInserted = 0

  try {
    for (const { table, model } of TABLES) {
      const rows = db.prepare(`SELECT * FROM "${table}"`).all() as Row[]
      const delegate = (prisma as unknown as Record<string, {
        createMany: (args: { data: Row[]; skipDuplicates?: boolean }) => Promise<{ count: number }>
      }>)[model]

      let inserted = 0
      if (!dryRun) {
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const chunk = rows.slice(i, i + CHUNK_SIZE).map((row) => convert(table, row))
          if (chunk.length === 0) continue
          const result = await delegate.createMany({ data: chunk, skipDuplicates: true })
          inserted += result.count
        }
      }
      totalInserted += inserted
      const detail = dryRun ? '' : ` → ${inserted} insérés`
      console.log(`${table.padEnd(16)} ${String(rows.length).padStart(7)} lignes${detail}`)
    }
  } finally {
    db.close()
  }

  console.log('')
  if (dryRun) {
    console.log('Dry-run : aucune écriture.')
  } else {
    console.log(`Terminé : ${totalInserted} lignes insérées (les doublons existants sont ignorés).`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
