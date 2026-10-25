-- Index de recherche plein-texte « contains » (ILIKE '%…%').
-- Un index B-tree ne sert à rien pour un motif commençant par un joker :
-- on utilise les trigrammes de `pg_trgm`.
--
-- `pg_trgm` est une extension « trusted » depuis PostgreSQL 13 : le
-- propriétaire de la base peut la créer sans être superutilisateur.
-- Rejoué à chaque démarrage (idempotent) car `prisma db push` réconcilie le
-- schéma et peut supprimer les index qu'il ne connaît pas.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Artist_name_trgm_idx"
  ON "Artist" USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Track_name_trgm_idx"
  ON "Track" USING gin (name gin_trgm_ops);
