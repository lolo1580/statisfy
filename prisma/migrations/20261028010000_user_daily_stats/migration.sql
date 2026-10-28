-- Agrégats quotidiens par utilisateur (jour local), pour la heatmap et les
-- records. Alimentés par l'application après chaque sync/import, et par
-- `pnpm db:backfill-daily-stats` pour les bases existantes.
CREATE TABLE "UserDailyStat" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "msPlayed" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "UserDailyStat_pkey" PRIMARY KEY ("userId", "day")
);

ALTER TABLE "UserDailyStat"
  ADD CONSTRAINT "UserDailyStat_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
