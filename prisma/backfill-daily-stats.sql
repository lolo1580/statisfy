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
