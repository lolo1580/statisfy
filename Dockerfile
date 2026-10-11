# Statisfy - image de production
# Node 22 (glibc) pour bénéficier des binaires précompilés de better-sqlite3.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable \
 && apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
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
ENV DATABASE_URL="file:/tmp/statisfy-build.db"
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
# plupart des comptes hôtes ; les volumes ./prisma et ./backups lui sont
# accessibles en écriture).
USER node
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
