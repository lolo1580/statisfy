# Statisfy - image de production
# Node 22 (glibc) + client PostgreSQL 18 (`pg_dump`) pour les sauvegardes.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# `postgresql-client-18` (dépôt PGDG) fournit `pg_dump`, utilisé par les
# sauvegardes (`/api/backup`) et l'export de la base (`/api/export/db`).
# La version du client doit être >= celle du serveur PostgreSQL
# (image `postgres:18-alpine` dans docker-compose).
RUN corepack enable \
 && apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates curl gnupg \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update -y \
 && apt-get install -y --no-install-recommends postgresql-client-18 \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- Dépendances + build ---
FROM base AS build
# Copier d'abord ce dont `prisma generate` (postinstall) a besoin.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY . .
# URL factice : le client Prisma est instancié à l'import pendant le build,
# mais aucune connexion réelle n'est faite. Le vrai DATABASE_URL est fourni
# au runtime par docker-compose.
ENV DATABASE_URL="postgresql://statisfy:statisfy@localhost:5432/statisfy"
RUN pnpm build
# Ne conserver que les dépendances de production (allège nettement l'image).
RUN pnpm prune --prod \
 && chmod +x docker-entrypoint.sh

# --- Image finale ---
FROM base AS runner
ENV NODE_ENV=production
# `--chown` évite une couche `chown -R` qui dupliquerait tout l'arbre.
COPY --chown=node:node --from=build /app ./
# Exécution sans privilèges (l'utilisateur `node` a l'UID/GID 1000, comme la
# plupart des comptes hôtes ; le volume ./backups lui est accessible en écriture).
USER node
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
