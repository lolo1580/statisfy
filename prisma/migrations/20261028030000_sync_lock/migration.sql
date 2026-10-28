-- Verrou distribué pour les synchronisations multi-instance.
-- Idempotent : la table peut déjà exister sur une base créée par `db push`.
CREATE TABLE IF NOT EXISTS "SyncLock" (
    "key" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLock_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "SyncLock_expiresAt_idx"
  ON "SyncLock" ("expiresAt");
