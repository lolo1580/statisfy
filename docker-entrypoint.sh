#!/bin/sh
set -e

# Sauvegarde de sécurité avant l'application du schéma (migrations), qui peut le
# modifier. Best-effort : on ignore l'échec (base pas encore joignable, etc.). On
# conserve les 3 dernières copies.
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
# Le CLI Prisma est isolé dans `/app/prisma-cli` (voir Dockerfile) : on s'y
# place le temps des commandes pour que `prisma.config.ts` résolve ses imports.
(
  cd /app/prisma-cli

  set +e
  migrate_out=$(./node_modules/.bin/prisma migrate deploy 2>&1)
  migrate_code=$?
  set -e

  if [ "$migrate_code" -eq 0 ]; then
    printf '%s\n' "$migrate_out" | tail -n 3
  elif printf '%s\n' "$migrate_out" | grep -q 'P3005'; then
    # Base existante mais **sans historique de migrations** (instance gérée
    # auparavant par `prisma db push`) : on marque la migration de référence
    # comme appliquée, puis on rejoue `migrate deploy` (qui applique les
    # migrations suivantes : ajout de `counted`, index trigram).
    echo "→ Base existante sans historique : baseline automatique…"
    ./node_modules/.bin/prisma migrate resolve --applied 20260101000000_init
    ./node_modules/.bin/prisma migrate deploy
  else
    printf '%s\n' "$migrate_out" >&2
    exit 1
  fi
)

echo "→ Démarrage de Statisfy sur le port ${PORT:-3000}…"
# `next start` est remplacé par le serveur `standalone` (`node server.js`).
# On force l'écoute sur toutes les interfaces : `HOSTNAME` est défini par Docker
# (ID du conteneur), ce qui lierait le serveur à la seule IP du conteneur.
export HOSTNAME=0.0.0.0
exec node server.js
