#!/bin/sh
set -e

# Sauvegarde de sécurité avant les migrations (qui peuvent modifier le schéma).
# Best-effort : on ignore l'échec (base pas encore joignable, etc.). On conserve
# les 3 dernières copies.
if [ -n "${DATABASE_URL:-}" ] && [ -d /backups ] && command -v pg_dump >/dev/null 2>&1; then
  stamp=$(date +%Y%m%dT%H%M%S)
  pg_dump --dbname "$DATABASE_URL" --format custom --no-owner --no-privileges \
    --file "/backups/statisfy-pre-push-$stamp.dump" 2>/dev/null \
    || rm -f "/backups/statisfy-pre-push-$stamp.dump"
  ls -1t /backups/statisfy-pre-push-*.dump 2>/dev/null | tail -n +4 | while read -r old; do
    rm -f "$old"
  done
fi

echo "→ Application des migrations de base de données…"
# Le CLI Prisma est isolé dans `/app/prisma-cli` (voir Dockerfile). On reste
# dans un sous-shell pour que `node server.js` s'exécute toujours depuis /app.
(
  cd /app/prisma-cli || exit 1

  # Base antérieure à Prisma Migrate : un schéma existe mais pas la table
  # `_prisma_migrations`. On enregistre la baseline (schéma de la release
  # précédente) comme appliquée, puis on déploie les migrations suivantes.
  if [ -n "${DATABASE_URL:-}" ] && command -v psql >/dev/null 2>&1; then
    has_user=$(psql "$DATABASE_URL" -tAc "select to_regclass('public.\"User\"') is not null" 2>/dev/null || echo "f")
    has_history=$(psql "$DATABASE_URL" -tAc "select to_regclass('public._prisma_migrations') is not null" 2>/dev/null || echo "f")
    if [ "$has_user" = "t" ] && [ "$has_history" != "t" ]; then
      echo "  Base existante sans historique : baseline de la migration initiale."
      ./node_modules/.bin/prisma migrate resolve --applied 20250101000000_init >/dev/null 2>&1 || true

      # Base déjà à jour via `db push` (dernière colonne de la migration
      # présente) : on marque aussi cette migration comme appliquée.
      has_new=$(psql "$DATABASE_URL" -tAc "select count(*) from information_schema.columns where table_schema='public' and table_name='User' and column_name='profileShareToken'" 2>/dev/null || echo "0")
      if [ "$has_new" = "1" ]; then
        ./node_modules/.bin/prisma migrate resolve --applied 20261025000000_play_metadata_and_shares >/dev/null 2>&1 || true
      fi
    fi
  fi

  if ! ./node_modules/.bin/prisma migrate deploy; then
    # Base partielle (ex. `db push` d'une version intermédiaire) : on réconcilie
    # le schéma, on marque les migrations comme appliquées puis on rejoue.
    echo "⚠ Migration en échec : réconciliation avec db push."
    ./node_modules/.bin/prisma db push
    # Efface les tentatives en échec (sinon `resolve` refuse de les marquer).
    psql "$DATABASE_URL" -q -c "delete from _prisma_migrations where finished_at is null and rolled_back_at is null" 2>/dev/null || true
    ./node_modules/.bin/prisma migrate resolve --applied 20250101000000_init >/dev/null 2>&1 || true
    ./node_modules/.bin/prisma migrate resolve --applied 20261025000000_play_metadata_and_shares >/dev/null 2>&1 || true
    ./node_modules/.bin/prisma migrate deploy
  fi

  # Filet de sécurité pour les bases plus anciennes que la baseline : si le
  # schéma diverge encore, on réconcilie avec `db push` (comportement
  # historique). On ignore les deux index trigram créés par `indexes.sql`, qui
  # ne font pas partie du schéma Prisma.
  if drift=$(./node_modules/.bin/prisma migrate diff \
    --from-config-datasource \
    --to-schema prisma/schema.prisma 2>&1); then
    unexpected=$(printf '%s\n' "$drift" \
      | grep -E '^[[:space:]]*\[[+-]\]' \
      | grep -v 'Removed index on columns (name)' || true)
    if [ -n "$unexpected" ]; then
      echo "⚠ Schéma non aligné après migrations : réconciliation avec db push."
      ./node_modules/.bin/prisma db push
      ./node_modules/.bin/prisma migrate resolve --applied 20261025000000_play_metadata_and_shares >/dev/null 2>&1 || true
    fi
  else
    echo "⚠ Vérification du schéma impossible (migrate diff) ; poursuite."
  fi
)

echo "→ Vérification des index de recherche…"
# `db push` / les migrations peuvent supprimer les index qu'ils ne connaissent
# pas (trigrammes) : on les recrée après chaque synchronisation. Non bloquant :
# sans eux, la recherche reste correcte mais plus lente sur une grosse
# bibliothèque.
if ! (cd /app/prisma-cli && ./node_modules/.bin/prisma db execute --file prisma/indexes.sql); then
  echo "⚠ Index trigram indisponibles (extension pg_trgm refusée ?)."
fi

echo "→ Vérification des agrégats quotidiens…"
# Première exécution après mise à jour : la table existe (migration) mais est
# vide. On la remplit une fois en SQL (l'image standalone n'embarque pas tsx).
# En cas d'échec, l'application retombe sur les écoutes brutes.
if [ -n "${DATABASE_URL:-}" ] && command -v psql >/dev/null 2>&1; then
  if ! daily_rows=$(psql "$DATABASE_URL" -tAc 'select count(*) from "UserDailyStat"' 2>/dev/null); then
    daily_rows="skip"
  else
    daily_rows=$(printf '%s' "$daily_rows" | tr -d '[:space:]')
  fi
  if [ "$daily_rows" = "0" ]; then
    echo "  Reconstruction initiale des agrégats (base existante)…"
    if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f /app/prisma-cli/prisma/backfill-daily-stats.sql; then
      echo "⚠ Backfill des agrégats impossible (repli sur les écoutes brutes)."
    fi
  elif [ "$daily_rows" = "skip" ]; then
    echo "  Table indisponible : étape ignorée."
  else
    echo "  Agrégats déjà présents ($daily_rows lignes)."
  fi
fi

echo "→ Démarrage de Statisfy sur le port ${PORT:-3000}…"
# `next start` est remplacé par le serveur `standalone` (`node server.js`).
# On force l'écoute sur toutes les interfaces : `HOSTNAME` est défini par Docker
# (ID du conteneur), ce qui lierait le serveur à la seule IP du conteneur.
export HOSTNAME=0.0.0.0
exec node server.js
