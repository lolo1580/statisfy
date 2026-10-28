-- Index composite utilisé par les agrégations de statistiques :
-- la majorité des requêtes filtrent `"userId"`, `"counted" = true` puis une
-- plage de dates. L'index `(userId, playedAt)` existant ne peut pas éliminer
-- les écoutes non comptées avant de lire la plage.
--
-- `IF NOT EXISTS` : la base d'une release antérieure peut déjà contenir
-- l'index (créé par `db push` ou `migrate diff --from-empty`).
CREATE INDEX IF NOT EXISTS "Play_userId_counted_playedAt_idx"
  ON "Play" ("userId", "counted", "playedAt");
