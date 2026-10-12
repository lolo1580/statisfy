#!/bin/sh
set -e

# Sauvegarde de sécurité avant `prisma db push` (qui peut modifier le schéma).
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

echo "→ Synchronisation du schéma de base de données…"
./node_modules/.bin/prisma db push

echo "→ Démarrage de Statisfy sur le port ${PORT:-3000}…"
exec ./node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-3000}"
