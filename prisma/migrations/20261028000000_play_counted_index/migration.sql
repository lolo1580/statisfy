-- Index composite utilisé par les agrégations de statistiques :
-- la majorité des requêtes filtrent `"userId"`, `"counted" = true` puis une
-- plage de dates. L'index `(userId, playedAt)` existant ne peut pas éliminer
-- les écoutes non comptées avant de lire la plage.
CREATE INDEX "Play_userId_counted_playedAt_idx"
  ON "Play" ("userId", "counted", "playedAt");
