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
# `output: "standalone"` (next.config.ts) produit `.next/standalone` : le
# serveur + les seules dépendances réellement utilisées. On n'a donc plus
# besoin de `pnpm prune`.
RUN pnpm build \
 && chmod +x docker-entrypoint.sh

# --- CLI Prisma isolé ---
# La sortie `standalone` de Next ne trace pas le CLI `prisma` (utilisé par
# l'entrypoint pour `migrate deploy`). On l'installe dans un préfixe dédié plutôt que
# d'embarquer tout `node_modules` de l'application.
FROM base AS prisma
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=1
WORKDIR /prisma
RUN npm install --omit=dev prisma@7.10.0 "dotenv@^18"

# --- Image finale ---
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
# Application auto-portée. `--chown` évite une couche `chown -R` qui
# dupliquerait tout l'arbre.
COPY --chown=node:node --from=build /app/.next/standalone ./
COPY --chown=node:node --from=build /app/.next/static ./.next/static
COPY --chown=node:node --from=build /app/public ./public
# CLI Prisma + config/schéma, regroupés pour que `prisma.config.ts` resolve
# `dotenv` et `prisma/config` depuis `./prisma-cli/node_modules`.
COPY --chown=node:node --from=prisma /prisma/node_modules ./prisma-cli/node_modules
COPY --chown=node:node --from=build /app/prisma.config.ts ./prisma-cli/prisma.config.ts
COPY --chown=node:node --from=build /app/prisma ./prisma-cli/prisma
COPY --chown=node:node --from=build /app/docker-entrypoint.sh ./docker-entrypoint.sh
# Exécution sans privilèges (l'utilisateur `node` a l'UID/GID 1000, comme la
# plupart des comptes hôtes ; le volume ./backups lui est accessible en écriture).
USER node
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
