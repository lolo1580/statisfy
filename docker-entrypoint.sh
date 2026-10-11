#!/bin/sh
set -e

# Sauvegarde de sécurité avant `prisma db push` (qui peut modifier le schéma).
# On conserve les 3 dernières copies.
if [ -f /data/dev.db ] && [ -d /backups ]; then
  stamp=$(date +%Y%m%dT%H%M%S)
  cp /data/dev.db "/backups/statisfy-pre-push-$stamp.db" 2>/dev/null || true
  ls -1t /backups/statisfy-pre-push-*.db 2>/dev/null | tail -n +4 | while read -r old; do
    rm -f "$old"
  done
fi

echo "→ Synchronisation du schéma de base de données…"
./node_modules/.bin/prisma db push

echo "→ Démarrage de Statisfy sur le port ${PORT:-3000}…"
exec ./node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-3000}"
