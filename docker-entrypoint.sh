#!/bin/sh
set -e

echo "→ Synchronisation du schéma de base de données…"
./node_modules/.bin/prisma db push

echo "→ Démarrage de Statisfy sur le port ${PORT:-3000}…"
exec ./node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-3000}"
