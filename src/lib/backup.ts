import "server-only";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "./db";

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
 * Crée un instantané cohérent de la base dans un fichier temporaire (pour un
 * téléchargement). `dispose()` supprime le fichier.
 */
export async function createTemporarySnapshot(): Promise<Snapshot> {
  const file = path.join(
    os.tmpdir(),
    `statisfy-export-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
  );
  const escaped = file.replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${escaped}'`);
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
      .filter((name) => name.startsWith("statisfy-") && name.endsWith(".db"))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/**
 * Crée une copie cohérente de la base via `VACUUM INTO`, puis applique une
 * rotation (garde les `BACKUP_KEEP` sauvegardes les plus récentes).
 */
export async function runBackup(): Promise<BackupResult> {
  const dir = backupDirectory();
  fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const suffix = Math.random().toString(36).slice(2, 8);
  const target = path.join(dir, `statisfy-${stamp}-${suffix}.db`);

  // `VACUUM INTO` produit un fichier cohérent même si la base est utilisée.
  const escaped = target.replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${escaped}'`);
  try {
    fs.chmodSync(/*turbopackIgnore: true*/ target, 0o600);
  } catch {
    // permissions best-effort
  }

  const files = fs
    .readdirSync(/*turbopackIgnore: true*/ dir)
    .filter((name) => name.startsWith("statisfy-") && name.endsWith(".db"))
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
