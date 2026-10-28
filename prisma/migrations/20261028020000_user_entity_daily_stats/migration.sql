-- Agrégats quotidiens par artiste et par titre : évitent de reparcourir les
-- écoutes brutes pour les graphiques des fiches détail.
--
-- Migration idempotente : les tables peuvent déjà exister sur une base créée
-- par `db push` (upgrade depuis une release antérieure).
CREATE TABLE IF NOT EXISTS "UserArtistDailyStat" (
    "userId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "msPlayed" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "UserArtistDailyStat_pkey"
      PRIMARY KEY ("userId", "artistId", "day")
);

CREATE INDEX IF NOT EXISTS "UserArtistDailyStat_userId_day_idx"
  ON "UserArtistDailyStat" ("userId", "day");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserArtistDailyStat_userId_fkey'
  ) THEN
    ALTER TABLE "UserArtistDailyStat"
      ADD CONSTRAINT "UserArtistDailyStat_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserArtistDailyStat_artistId_fkey'
  ) THEN
    ALTER TABLE "UserArtistDailyStat"
      ADD CONSTRAINT "UserArtistDailyStat_artistId_fkey"
      FOREIGN KEY ("artistId") REFERENCES "Artist"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "UserTrackDailyStat" (
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "msPlayed" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "UserTrackDailyStat_pkey"
      PRIMARY KEY ("userId", "trackId", "day")
);

CREATE INDEX IF NOT EXISTS "UserTrackDailyStat_userId_day_idx"
  ON "UserTrackDailyStat" ("userId", "day");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserTrackDailyStat_userId_fkey'
  ) THEN
    ALTER TABLE "UserTrackDailyStat"
      ADD CONSTRAINT "UserTrackDailyStat_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UserTrackDailyStat_trackId_fkey'
  ) THEN
    ALTER TABLE "UserTrackDailyStat"
      ADD CONSTRAINT "UserTrackDailyStat_trackId_fkey"
      FOREIGN KEY ("trackId") REFERENCES "Track"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
