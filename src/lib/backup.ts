import "server-only";

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Extension des sauvegardes (`pg_dump` au format personnalisé). */
const DUMP_EXT = ".dump";

export function backupDirectory(): string {
  return process.env.BACKUP_DIR || path.join(process.cwd(), "backups");
}

function keepCount(): number {
  const value = Number(process.env.BACKUP_KEEP);
  return Number.isFinite(value) && value > 0 ? value : 7;
}

export type BackupResult = { file: string; kept: number; directory: string };

export type Snapshot = { file: string; dispose: () => void };

/**
 * Produit un dump PostgreSQL cohérent de la base vers `target` (format
 * personnalisé `pg_dump`, restaurable avec `pg_restore`).
 *
 * `pg_dump` doit être disponible dans le `PATH` (paquet `postgresql-client`).
 * La connexion est passée via `DATABASE_URL` : aucun shell n'est invoqué, donc
 * le mot de passe ou les caractères spéciaux de l'URL ne posent pas de problème.
 */
async function dumpDatabase(target: string): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL est manquant.");
  try {
    await execFileAsync(
      "pg_dump",
      [
        "--dbname",
        url,
        "--format",
        "custom",
        "--no-owner",
        "--no-privileges",
        "--file",
        target,
      ],
      { maxBuffer: 16 * 1024 * 1024 },
    );
  } catch (error) {
    // Ne pas laisser un dump partiel derrière soi (pg_dump crée le fichier tôt).
    fs.rmSync(/*turbopackIgnore: true*/ target, { force: true });
    throw error;
  }
}

/**
 * Crée un dump temporaire de la base (pour un téléchargement). `dispose()`
 * supprime le fichier.
 */
export async function createTemporarySnapshot(): Promise<Snapshot> {
  const file = path.join(
    os.tmpdir(),
    `statisfy-export-${Date.now()}-${Math.random().toString(36).slice(2)}${DUMP_EXT}`,
  );
  await dumpDatabase(file);
  try {
    fs.chmodSync(/*turbopackIgnore: true*/ file, 0o600);
  } catch {
    // permissions best-effort
  }
  return { file, dispose: () => fs.rmSync(file, { force: true }) };
}

/** Liste les fichiers de sauvegarde (les plus récents en premier). */
export function listBackups(): string[] {
  const dir = backupDirectory();
  try {
    return fs
      .readdirSync(/*turbopackIgnore: true*/ dir)
      .filter((name) => name.startsWith("statisfy-") && name.endsWith(DUMP_EXT))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/**
 * Crée un dump de la base via `pg_dump`, puis applique une rotation (garde les
 * `BACKUP_KEEP` sauvegardes les plus récentes).
 */
export async function runBackup(): Promise<BackupResult> {
  const dir = backupDirectory();
  fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const suffix = Math.random().toString(36).slice(2, 8);
  const target = path.join(dir, `statisfy-${stamp}-${suffix}${DUMP_EXT}`);

  await dumpDatabase(target);
  try {
    fs.chmodSync(/*turbopackIgnore: true*/ target, 0o600);
  } catch {
    // permissions best-effort
  }

  const files = fs
    .readdirSync(/*turbopackIgnore: true*/ dir)
    .filter((name) => name.startsWith("statisfy-") && name.endsWith(DUMP_EXT))
    .sort();
  const keep = keepCount();
  const toDelete = files.slice(0, Math.max(0, files.length - keep));
  for (const name of toDelete) {
    fs.rmSync(
      /*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir, name),
      { force: true },
    );
  }

  return {
    file: path.basename(target),
    kept: files.length - toDelete.length,
    directory: dir,
  };
}
