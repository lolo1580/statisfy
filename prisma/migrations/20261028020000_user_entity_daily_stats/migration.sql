-- Agrégats quotidiens par artiste et par titre : évitent de reparcourir les
-- écoutes brutes pour les graphiques des fiches détail.
CREATE TABLE "UserArtistDailyStat" (
    "userId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "msPlayed" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "UserArtistDailyStat_pkey"
      PRIMARY KEY ("userId", "artistId", "day")
);

CREATE INDEX "UserArtistDailyStat_userId_day_idx"
  ON "UserArtistDailyStat" ("userId", "day");

ALTER TABLE "UserArtistDailyStat"
  ADD CONSTRAINT "UserArtistDailyStat_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserArtistDailyStat"
  ADD CONSTRAINT "UserArtistDailyStat_artistId_fkey"
  FOREIGN KEY ("artistId") REFERENCES "Artist"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserTrackDailyStat" (
    "userId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "msPlayed" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "UserTrackDailyStat_pkey"
      PRIMARY KEY ("userId", "trackId", "day")
);

CREATE INDEX "UserTrackDailyStat_userId_day_idx"
  ON "UserTrackDailyStat" ("userId", "day");

ALTER TABLE "UserTrackDailyStat"
  ADD CONSTRAINT "UserTrackDailyStat_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTrackDailyStat"
  ADD CONSTRAINT "UserTrackDailyStat_trackId_fkey"
  FOREIGN KEY ("trackId") REFERENCES "Track"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
