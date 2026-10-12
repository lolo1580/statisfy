# 🎧 Statisfy

[![CI](https://github.com/lolo1580/statisfy/actions/workflows/ci.yml/badge.svg)](https://github.com/lolo1580/statisfy/actions/workflows/ci.yml)
[![Docker](https://github.com/lolo1580/statisfy/actions/workflows/docker.yml/badge.svg)](https://github.com/lolo1580/statisfy/actions/workflows/docker.yml)

**English** · [Français](README.fr.md)

> 🎨 **Static preview (mock-up, fake data)**: <https://lolo1580.github.io/statisfy/>

A **self-hosted** dashboard to explore your Spotify listening stats. An
independent, modern rewrite inspired by the idea of *Your Spotify*, but designed
to be **easy to deploy**, **fast** and **pleasant to explore**.

> Statisfy is not affiliated with Spotify. All trademarks belong to their
> respective owners.
> See the [changelog](CHANGELOG.md).

## ✨ Features

- **Spotify source**: OAuth connection (recent plays + genres) and import of
  your data exports (privacy / extended streaming history).
- **Multi-user**: each person creates an account and connects their **own**
  Spotify account; data is isolated per account. Public **registrations** can be
  closed with one click, and an administrator manages **accounts**,
  **invitations** and approves **Spotify access requests**.
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
- **Compare periods**: side-by-side two-period comparator with overlaid
  listening time, metric deltas and parallel rankings (artists, tracks, genres).
- **Export**: recap as a **PNG image** (square 1080×1080 or story 1080×1920) and
  **CSV** of the whole history. The recap can also be shared through a **public
  read-only link** (enable/disable in Settings).
- **Status**: instance health (listening totals, last sync, uptime, database
  size, backups, recent activity) built into the **Settings** page.
- **Filters**: by period (today, week, month, year, all — calendar-based, in the
  account's timezone; **default: today**).
- **Multilingual**: English (default) and French, with a language switcher in
  the UI (localized dates and numbers).
- **Trends & heatmap**: GitHub-style yearly heatmap and comparison between two
  periods (rising / falling artists).
- **Trends page**: dedicated `/trends` view comparing two consecutive windows
  (7/30/90 days, 1 year) for rising and falling **artists, tracks and albums**.
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
| Database | PostgreSQL 18 via Prisma 7 + `@prisma/adapter-pg` driver adapter |
| UI | Tailwind CSS v4, hand-rolled components, dependency-free SVG charts |
| Auth | `jose` (JWT), `node:crypto` (scrypt, AES-GCM) |
| Image | `next/og` (PNG recap) |
| Tests | Vitest |

## 🚀 Quick start (local)

Requirements: **Node.js 22+**, **pnpm**, and a **PostgreSQL 18** server (the
Docker `db` service below works too).

```bash
# 1. Dependencies
pnpm install

# 2. Configuration
cp .env.example .env
openssl rand -base64 32   # -> SESSION_SECRET
openssl rand -base64 32   # -> CREDENTIALS_KEY
# Set POSTGRES_PASSWORD (and DATABASE_URL) in .env — see Configuration below.

# 3. Database: start PostgreSQL (or use your own instance)
docker compose up -d db        # PostgreSQL on localhost:$POSTGRES_PORT (default 5432)

# 4. Apply the schema
pnpm db:push

# 5. (optional) demo dataset
pnpm db:seed

# 6. Development
pnpm dev        # http://localhost:3000
```

The **first account created becomes the administrator**. Locally, `pnpm db:seed`
creates a demo account (`demo@statisfy.local` / `statisfy123`) — do not keep it
on a public instance.

Statisfy is **multi-user**: each person creates an account and connects their
**own** Spotify account (Settings → Connect Spotify); listens, statistics and
connections are isolated per account. From **Settings → Users**, an
administrator can promote other admins, reset a password or delete an account,
and generate **invitation links** (“Invitations”) — handy for keeping
registrations closed while inviting people case by case.

### Local production

```bash
pnpm build
pnpm start
```

## 🐳 Docker (recommended)

```bash
cp .env.example .env
# Fill in SESSION_SECRET, CREDENTIALS_KEY and POSTGRES_PASSWORD

docker compose up -d --build
```

- The app is served on `http://localhost:3000`.
- PostgreSQL runs in the **`db`** service, persisted in the **`pgdata`** volume.
- The Prisma schema is applied automatically on startup.
- A **`cron`** service calls `POST /api/sync` **every 2 minutes**
  (requires `SYNC_TOKEN`).

```bash
docker compose ps                  # service status
docker compose logs -f statisfy    # logs
docker compose up -d --build       # rebuild after a code change
docker compose up -d               # recreate after a .env change
```

### Optional: prebuilt image (GHCR)

By default, `docker compose` **builds from source** — no GitHub needed. The
Docker image is published to the GitHub Container Registry **manually**
(Actions → *Docker* → *Run workflow*); nothing is pushed on regular commits.

To deploy the published image instead of building locally, uncomment the
`image:` line in `docker-compose.yml` (optionally set `STATISFY_IMAGE` in `.env`
to pin a tag), then:

```bash
docker compose pull
docker compose up -d
```

> With a **public repository** (as here) the image is public and `docker pull`
> works without authentication. For a private repository/package, authenticate
> once with a token that has the `read:packages` scope:
> ```bash
> echo "$CR_PAT" | docker login ghcr.io -u <user> --password-stdin
> ```

### Production (build-free)

For a real deployment, a dedicated compose file uses the **published image**
(no build), keeps the database **unexposed**, binds the app to **localhost**
(behind your reverse proxy) and caps log size:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Pin another version with `STATISFY_IMAGE` (e.g. `ghcr.io/lolo1580/statisfy:1.0.0`)
and set `STATISFY_BIND` if your proxy runs on another network.

## ⚙️ Configuration

Every variable is documented in [`.env.example`](.env.example).

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Credentials of the `db` service; used to build `DATABASE_URL` in Docker. |
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

## ♻️ Migrating from SQLite

Earlier versions stored everything in SQLite (`prisma/dev.db`). To move an
existing database to PostgreSQL:

```bash
docker compose up -d db     # or point DATABASE_URL at your own PostgreSQL
pnpm db:push                # create the schema
pnpm migrate:sqlite         # copy users, connections, plays… (idempotent)
```

Options: `--sqlite <path>` for another file, `--dry-run` to preview. IDs are
preserved, encrypted source credentials are copied as-is and already-present
rows are skipped, so the command is safe to re-run.

## 🎵 Spotify source

### OAuth connection

1. Create an application on the
   [Spotify developer dashboard](https://developer.spotify.com/dashboard).
2. Add a redirect URL. The path `/oauth/spotify/callback` is accepted (as is
   `/api/sources/spotify/callback`), for example:
   - locally: `http://127.0.0.1:3000/oauth/spotify/callback` (not `localhost`)
   - in production: `https://statisfy.mydomain.org/oauth/spotify/callback`
3. Fill in `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and
   `SPOTIFY_REDIRECT_URI`, then restart.
4. In **Settings → Connect Spotify**, click *Connect my account*.
5. Click **Sync**: recent plays **and genres** are fetched.

> **Spotify Development mode (≤ 25 accounts)**: each user must first **request
> access** (Settings → Connect Spotify, giving their Spotify account). An
> administrator **approves** the request after adding the account in the Spotify
> dashboard, from the **Spotify access requests** section in Settings.
> Administrators are allowed by default, and history imports remain available
> while waiting for approval.

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
| `POST /api/backup` | Back up the PostgreSQL database (`pg_dump`). Auth: `Bearer $SYNC_TOKEN` or admin session. |
| `POST /api/restore` | Restore a PostgreSQL dump (`.dump`), replacing current data. Auth: `Bearer $SYNC_TOKEN` or admin session. CLI: `pnpm db:restore <file>`. |
| `POST /api/import/spotify-history` | Import a Spotify export (`.zip` "Extended streaming history" or `.json`). Auth: `Bearer $SYNC_TOKEN`, HTTP Basic or admin session. |
| `POST /api/import/your-spotify` | Import a *Your Spotify* dump (`.zip` archive) from a server. Auth: `Bearer $SYNC_TOKEN`, HTTP Basic (`-u email:password`) or admin session. |
| `GET /api/export` | CSV export of the logged-in user's history. |
| `GET /api/export/db` | Full PostgreSQL dump (`.dump`). Auth: `Bearer $SYNC_TOKEN` or admin session. |
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
  app/                 # Routes: login, dashboard, top, compare, trends, wrapped,
                       # history, status, search, artist/[id], track/[id],
                       # settings, api
  components/          # UI (cards, SVG charts, navigation, forms)
  i18n/                # Dictionaries (EN by default, FR) + server helpers
  lib/
    auth/              # Sessions, DAL, auth actions
    sources/           # Spotify adapter, import, enrichment, OAuth state
    sync/              # Idempotent ingestion engine + orchestration
    stats.ts           # Aggregation queries (including trends)
    backup.ts          # PostgreSQL backups (pg_dump + rotation)
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

## 🧪 Tests

Unit tests cover the pure helpers (formatting, periods, ranges, comparison,
password hashing and credential encryption):

```bash
pnpm test        # single run
pnpm test:watch  # watch mode
```

## ⚖️ License and legal notice

Statisfy is an **independent rewrite**: no code from *Your Spotify* was copied.
The project is distributed under the **GNU General Public License v3.0** (see
[`LICENSE`](LICENSE)): you may modify and redistribute it, provided that
derivative works remain under the same license (copyleft) and that their source
code is provided.

Spotify API terms of use and trademark compliance remain your responsibility.
