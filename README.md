# 🎧 Statisfy

[![CI](https://github.com/lolo1580/statisfy/actions/workflows/ci.yml/badge.svg)](https://github.com/lolo1580/statisfy/actions/workflows/ci.yml)
[![Docker](https://github.com/lolo1580/statisfy/actions/workflows/docker.yml/badge.svg)](https://github.com/lolo1580/statisfy/actions/workflows/docker.yml)

**English** · [Français](README.fr.md)

A **self-hosted** dashboard to explore your Spotify listening stats. An
independent, modern rewrite inspired by the idea of *Your Spotify*, but designed
to be **easy to deploy**, **fast** and **pleasant to explore**.

> Statisfy is not affiliated with Spotify. All trademarks belong to their
> respective owners.
> See the [changelog](CHANGELOG.md).

## ✨ Features

- **Spotify source**: OAuth connection (recent plays + genres) and import of
  your data exports (privacy / extended streaming history).
- **Automatic artwork**: missing visuals (especially after an import) are
  completed via the **Spotify catalog**.
- **Rich statistics**: listening time, top tracks / artists / albums, weighted
  genres, daily listening, hourly breakdown, recent plays.
- **Plays / time toggle**: on the ranking panels (Dashboard and Rankings), a
  per-panel switch changes the display **and the sorting**, instantly.
- **Interactive charts**: grid, axes (durations) and hover tooltip (full date +
  listening time).
- **Exploration**: **artist** and **track** detail pages, **search** across your
  library.
- **Recap ("Wrapped")**: yearly or monthly summary with comparison to the
  previous period, busiest day/hour and discovered artists.
- **Export**: recap as a **PNG image** (1080×1080) and **CSV** of the whole
  history.
- **Status**: instance health page (last sync, today's plays, source status,
  database size, recent activity).
- **Filters**: by period (today, week, month, year, all — calendar-based, in the
  account's timezone) and by source (Spotify, import).
- **Multilingual**: English (default) and French, with a language switcher in
  the UI (localized dates and numbers).
- **Trends & heatmap**: GitHub-style yearly heatmap and comparison between two
  periods (rising / falling artists).
- **Discoveries**: dedicated page — current obsessions and artists to
  rediscover.
- **Backups**: automatic database copy (configurable rotation) + dedicated
  endpoint.
- **Robust deduplication**: a play is never counted twice.
- **Secure sessions**: `scrypt` passwords, revocable JWT sessions, encrypted
  source credentials (AES-256-GCM).
- **Docker deployment** in one command and **automatic synchronization**.

## 🧱 Stack

| Item | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19, Server Actions) |
| Language | TypeScript |
| Database | SQLite via Prisma 7 + `better-sqlite3` driver adapter |
| UI | Tailwind CSS v4, hand-rolled components, dependency-free SVG charts |
| Auth | `jose` (JWT), `node:crypto` (scrypt, AES-GCM) |
| Image | `next/og` (PNG recap) |

## 🚀 Quick start (local)

Requirements: **Node.js 22+** and **pnpm**.

```bash
# 1. Dependencies
pnpm install

# 2. Configuration
cp .env.example .env
openssl rand -base64 32   # -> SESSION_SECRET
openssl rand -base64 32   # -> CREDENTIALS_KEY

# 3. Database
pnpm db:push

# 4. (optional) demo dataset
pnpm db:seed

# 5. Development
pnpm dev        # http://localhost:3000
```

The **first account created becomes the administrator**. Locally, `pnpm db:seed`
creates a demo account (`demo@statisfy.local` / `statisfy123`) — do not keep it
on a public instance.

### Local production

```bash
pnpm build
pnpm start
```

## 🐳 Docker (recommended)

```bash
cp .env.example .env
# Fill in SESSION_SECRET and CREDENTIALS_KEY

docker compose up -d --build
```

- The app is served on `http://localhost:3000`.
- The SQLite database is persisted through the `./prisma:/data` mount.
- The Prisma schema is applied automatically on startup.
- A **`cron`** service calls `POST /api/sync` **every 2 minutes**
  (requires `SYNC_TOKEN`).

```bash
docker compose ps                  # service status
docker compose logs -f statisfy    # logs
docker compose up -d --build       # rebuild after a code change
docker compose up -d               # recreate after a .env change
```

### Pull the prebuilt image (GHCR)

Every push to `main` and every `v*` tag publishes a multi-arch image
(`linux/amd64`, `linux/arm64`) to the GitHub Container Registry:

```bash
docker pull ghcr.io/lolo1580/statisfy:latest
```

To deploy it without building locally:

```bash
docker compose pull
docker compose up -d
```

> The package is **private** as long as the repository is private. Authenticate
> once with a token that has the `read:packages` scope:
> ```bash
> echo "$CR_PAT" | docker login ghcr.io -u <user> --password-stdin
> ```
> To make the image public: GitHub → profile → *Packages* → `statisfy` →
> *Package settings* → *Change visibility*.

## ⚙️ Configuration

Every variable is documented in [`.env.example`](.env.example).

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | SQLite path, e.g. `file:./prisma/dev.db`. |
| `SESSION_SECRET` | Session signing secret (`openssl rand -base64 32`). |
| `CREDENTIALS_KEY` | AES-256 key (32 bytes base64) to encrypt credentials. |
| `ALLOW_REGISTRATION` | `true`/`false` (overridable from the admin UI). |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Spotify application. |
| `SPOTIFY_REDIRECT_URI` | Must match a redirect URL allowed in Spotify. |
| `APP_URL` | Public URL of the UI (redirects behind a proxy). |
| `COOKIE_DOMAIN` | Shared cookie domain when the UI and the callback live on different subdomains. |
| `SYNC_TOKEN` | Token protecting `POST /api/sync` (used by the cron). |
| `SYNC_MIN_INTERVAL_MS` | Minimum interval between two API-triggered syncs (default `120000`). |
| `BACKUP_KEEP` | Number of database backups to keep (default `7`). |

## 🎵 Spotify source

### OAuth connection

1. Create an application on the
   [Spotify developer dashboard](https://developer.spotify.com/dashboard).
2. Add a redirect URL. The path `/oauth/spotify/callback` is accepted (as is
   `/api/sources/spotify/callback`), for example:
   - locally: `http://localhost:3000/oauth/spotify/callback`
   - in production: `https://statisfy.mydomain.org/oauth/spotify/callback`
3. Fill in `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and
   `SPOTIFY_REDIRECT_URI`, then restart.
4. In **Settings → Connect Spotify**, click *Connect my account*.
5. Click **Sync**: recent plays **and genres** are fetched.

> The Spotify API only returns the last 50 tracks. Automatic syncing (cron)
> avoids losing them; for the full history, use the import below.

### Importing Spotify history

1. Request your data on
   [Spotify → Privacy](https://www.spotify.com/account/privacy/)
   ("Extended streaming history" recommended).
2. In **Settings → Import Spotify history**, drop the `.zip` archive you
   received from Spotify, or the `Streaming_History_Audio_*.json` files
   (up to 128 MB per request). Missing artwork is then completed automatically.
3. The import is **idempotent**: re-running the same file creates no duplicate.

For large histories (several years), prefer the command line or the HTTP API
(no browser limit):

```bash
# from the command line, on the server that has the export
pnpm import:spotify-history ~/Downloads/my_spotify_data.zip --email you@example.com

# via the API (see "POST /api/import/spotify-history" below)
curl --user 'you@example.com:password' \
  --data-binary @my_spotify_data.zip \
  https://my-domain/api/import/spotify-history
```

### Migrating from *Your Spotify*

Two ways to recover your *Your Spotify* history (MongoDB).

**A. From the UI (recommended)** — via a dump:

1. Dump the database:
   ```bash
   mongodump --uri="mongodb://localhost:27017/your_spotify" --out=./ys-dump
   ```
2. Compress the folder into a `.zip` (optional).
3. In **Settings → Import from Your Spotify**, drop the dump files
   (`infos`, `tracks`, `albums`, `artists`, as `.bson` or `.json`) **or** the
   `.zip`. Genres and artwork are picked up; the import is idempotent.

**B. From the command line** (direct MongoDB connection):

```bash
MONGO_URL="mongodb://localhost:27017/your_spotify" \
  pnpm import:your-spotify --email you@example.com
```

- `--mongo <url>`: MongoDB URL (otherwise the `MONGO_URL` variable).
- `--email <mail>`: target Statisfy account (otherwise the oldest account).
- `--limit <n>`: process only the first n plays (testing).

In both cases, the import is **idempotent** (re-running creates no duplicate).

> MongoDB 8 refuses to start on Linux kernels ≥ 6.19 (known bug): use a
> MongoDB 6 or 7 image if needed.

## 🔌 API

| Route | Description |
| --- | --- |
| `GET /api/sync` | Sync due connections. Auth: `Bearer $SYNC_TOKEN` or admin session. |
| `POST /api/backup` | Back up the SQLite database. Auth: `Bearer $SYNC_TOKEN` or admin session. |
| `POST /api/import/spotify-history` | Import a Spotify export (`.zip` "Extended streaming history" or `.json`). Auth: `Bearer $SYNC_TOKEN`, HTTP Basic or admin session. |
| `POST /api/import/your-spotify` | Import a *Your Spotify* dump (`.zip` archive) from a server. Auth: `Bearer $SYNC_TOKEN`, HTTP Basic (`-u email:password`) or admin session. |
| `GET /api/export` | CSV export of the logged-in user's history. |
| `GET /api/wrapped/image` | PNG image of the recap (`?year=2026&month=10`). |
| `GET /oauth/spotify/callback` | Spotify OAuth return (to declare on Spotify's side). |
| `GET /api/sources/spotify/start` | Starts the Spotify OAuth flow. |

External cron example:

```bash
curl -X POST -H "Authorization: Bearer $SYNC_TOKEN" https://my-domain/api/sync
```

Import a *Your Spotify* dump without a browser (useful when the source server is
only reachable over SSH):

```bash
# with a standard account (simplest)
curl -u 'you@example.com:password' \
  --data-binary @ys-dump.zip \
  https://my-domain/api/import/your-spotify

# or with the global token
curl -X POST -H "Authorization: Bearer $SYNC_TOKEN" \
  --data-binary @ys-dump.zip \
  https://my-domain/api/import/your-spotify
```

With a standard account, the dump is assigned to that account. With the token
(or an admin session), it is assigned to the first administrator; use
`?email=you@example.com` to target another account. The import is idempotent.

## 🗂️ Project structure

```
prisma/
  schema.prisma        # Models (User, Play, Track, Artist, Album, Job, ...)
  seed.ts              # Demo data
src/
  app/                 # Routes: login, dashboard, top, wrapped, insights,
                       # history, status, search, artist/[id], track/[id],
                       # settings, api
  components/          # UI (cards, SVG charts, navigation, forms)
  i18n/                # Dictionaries (EN by default, FR) + server helpers
  lib/
    auth/              # Sessions, DAL, auth actions
    sources/           # Spotify adapter, import, enrichment, OAuth state
    sync/              # Idempotent ingestion engine + orchestration
    stats.ts           # Aggregation queries (including trends/discoveries)
    backup.ts          # SQLite backups (VACUUM INTO + rotation)
    period.ts          # Recap periods
    crypto.ts          # Credential encryption
    db.ts              # Prisma client
```

### Adding a source

1. Implement `SourceAdapter` in `src/lib/sources/`.
2. Register it in `src/lib/sources/registry.ts`.
3. Add the matching form in `src/app/(app)/settings`.

The engine (`src/lib/sync/`) handles the rest: deduplication, entity resolution,
metadata and genres.

## 🗺️ Roadmap

- Side-by-side two-period comparator.
- "Story" image format (1080×1920) for the recap.
- Advanced multi-user mode (dashboard sharing).
- Automated tests.

## ⚖️ License and legal notice

Statisfy is an **independent rewrite**: no code from *Your Spotify* was copied.
The project is distributed under the **GNU General Public License v3.0** (see
[`LICENSE`](LICENSE)): you may modify and redistribute it, provided that
derivative works remain under the same license (copyleft) and that their source
code is provided.

Spotify API terms of use and trademark compliance remain your responsibility.
