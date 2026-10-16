-- Index trigram pour la recherche « contient » (LIKE '%…%') sur les noms.
-- Sans index GIN trigram, la recherche fait un parcours séquentiel.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Artist_name_trgm_idx" ON "Artist" USING gin ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Track_name_trgm_idx" ON "Track" USING gin ("name" gin_trgm_ops);
