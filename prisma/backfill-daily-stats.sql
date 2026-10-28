-- Reconstruction initiale des agrégats quotidiens (jour local de chaque
-- utilisateur). Exécuté par l'entrypoint Docker quand la table est vide.
-- Idempotent : ON CONFLICT conserve les lignes déjà présentes.
INSERT INTO "UserDailyStat" ("userId", "day", "plays", "msPlayed")
SELECT p."userId",
       to_char(
         (p."playedAt" AT TIME ZONE 'UTC') AT TIME ZONE u."timezone",
         'YYYY-MM-DD'
       ),
       COUNT(*)::int,
       COALESCE(SUM(p."msPlayed"), 0)::bigint
FROM "Play" p
JOIN "User" u ON u."id" = p."userId"
WHERE p."counted" = true
GROUP BY 1, 2
ON CONFLICT ("userId", "day") DO NOTHING;

INSERT INTO "UserArtistDailyStat"
  ("userId", "artistId", "day", "plays", "msPlayed")
SELECT p."userId",
       p."artistId",
       to_char(
         (p."playedAt" AT TIME ZONE 'UTC') AT TIME ZONE u."timezone",
         'YYYY-MM-DD'
       ),
       COUNT(*)::int,
       COALESCE(SUM(p."msPlayed"), 0)::bigint
FROM "Play" p
JOIN "User" u ON u."id" = p."userId"
WHERE p."counted" = true
GROUP BY 1, 2, 3
ON CONFLICT ("userId", "artistId", "day") DO NOTHING;

INSERT INTO "UserTrackDailyStat"
  ("userId", "trackId", "day", "plays", "msPlayed")
SELECT p."userId",
       p."trackId",
       to_char(
         (p."playedAt" AT TIME ZONE 'UTC') AT TIME ZONE u."timezone",
         'YYYY-MM-DD'
       ),
       COUNT(*)::int,
       COALESCE(SUM(p."msPlayed"), 0)::bigint
FROM "Play" p
JOIN "User" u ON u."id" = p."userId"
WHERE p."counted" = true
GROUP BY 1, 2, 3
ON CONFLICT ("userId", "trackId", "day") DO NOTHING;
