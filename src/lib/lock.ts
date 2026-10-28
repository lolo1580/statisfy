import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "./db";

/**
 * Verrou distribué en base (table `SyncLock`).
 *
 * Utilisé pour les synchronisations : deux instances (ou deux requêtes sur des
 * processus différents) ne doivent pas synchroniser la même connexion en même
 * temps. Le verrou porte une **expiration** et un **heartbeat** : si le
 * processus meurt, le verrou est repris automatiquement après le TTL.
 */

const DEFAULT_TTL_MS = 15 * 60 * 1000;

function ttlMs(): number {
  const value = Number(process.env.SYNC_LOCK_TTL_MS);
  return Number.isFinite(value) && value >= 5_000 ? value : DEFAULT_TTL_MS;
}

export class LockBusyError extends Error {
  readonly code = "LOCK_BUSY";

  constructor(readonly key: string) {
    super("Une opération est déjà en cours pour cette ressource.");
    this.name = "LockBusyError";
  }
}

export type LockHandle = {
  key: string;
  owner: string;
  release: () => Promise<void>;
};

/**
 * Tente d'acquérir le verrou `key`. Renvoie `null` s'il est détenu par un
 * autre propriétaire et non expiré. L'acquisition est atomique (upsert
 * conditionnel en SQL) : une seule instance peut réussir.
 */
export async function acquireLock(
  key: string,
  ttl: number = ttlMs(),
): Promise<LockHandle | null> {
  const owner = randomUUID();
  const expiresAt = new Date(Date.now() + ttl);

  const rows = await prisma.$queryRaw<Array<{ owner: string }>>(
    Prisma.sql`
      INSERT INTO "SyncLock" ("key", "owner", "expiresAt")
      VALUES (${key}, ${owner}, ${expiresAt})
      ON CONFLICT ("key") DO UPDATE
        SET "owner" = EXCLUDED."owner",
            "expiresAt" = EXCLUDED."expiresAt"
        WHERE "SyncLock"."expiresAt" < now()
      RETURNING "owner"
    `,
  );

  if (rows[0]?.owner !== owner) return null;
  return {
    key,
    owner,
    release: () => releaseLock(key, owner),
  };
}

/** Libère le verrou s'il appartient toujours à `owner`. */
export async function releaseLock(key: string, owner: string): Promise<void> {
  await prisma.syncLock
    .deleteMany({ where: { key, owner } })
    .catch(() => undefined);
}

/** Prolonge le verrou ; renvoie `false` s'il a été perdu. */
export async function renewLock(
  key: string,
  owner: string,
  ttl: number = ttlMs(),
): Promise<boolean> {
  const result = await prisma.syncLock
    .updateMany({
      where: { key, owner },
      data: { expiresAt: new Date(Date.now() + ttl) },
    })
    .catch(() => ({ count: 0 }));
  return result.count > 0;
}

/** Démarre le heartbeat ; la fonction renvoyée l'arrête. */
export function startLockHeartbeat(
  handle: LockHandle,
  ttl: number = ttlMs(),
): () => void {
  const timer = setInterval(
    () => {
      void renewLock(handle.key, handle.owner, ttl);
    },
    Math.max(1_000, Math.floor(ttl / 3)),
  );
  // Ne bloque pas l'arrêt du processus si c'est le dernier timer actif.
  timer.unref?.();
  return () => clearInterval(timer);
}

/**
 * Exécute `fn` en détenant le verrou. Lève `LockBusyError` si la ressource est
 * déjà verrouillée. Le heartbeat est arrêté et le verrou libéré dans tous les
 * cas.
 */
export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = ttlMs(),
): Promise<T> {
  const handle = await acquireLock(key, ttl);
  if (!handle) throw new LockBusyError(key);

  const stop = startLockHeartbeat(handle, ttl);
  try {
    return await fn();
  } finally {
    stop();
    await handle.release();
  }
}
