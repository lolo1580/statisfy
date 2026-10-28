-- Agrégats quotidiens par utilisateur (jour local), pour la heatmap et les
-- records. Alimentés par l'application après chaque sync/import, et par
-- `pnpm db:backfill-daily-stats` pour les bases existantes.
--
-- `IF NOT EXISTS` + contraintes gardées : la table peut déjà exister sur une
-- base créée par `db push` (upgrade depuis une release antérieure).
CREATE TABLE IF NOT EXISTS "UserDailyStat" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "msPlayed" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "UserDailyStat_pkey" PRIMARY KEY ("userId", "day")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserDailyStat_userId_fkey'
  ) THEN
    ALTER TABLE "UserDailyStat"
      ADD CONSTRAINT "UserDailyStat_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
