# 🎧 Statisfy

[![CI](https://github.com/lolo1580/statisfy/actions/workflows/ci.yml/badge.svg)](https://github.com/lolo1580/statisfy/actions/workflows/ci.yml)

Tableau de bord **auto-hébergé** pour explorer vos statistiques d'écoute Spotify.
Réécriture libre et moderne, inspirée de l'idée de *Your Spotify*, mais pensée
pour être **simple à déployer**, **rapide** et **agréable à explorer**.

> Statisfy n'est pas affilié à Spotify. Les marques citées appartiennent à
> leurs propriétaires respectifs.
> Voir le [journal des modifications](CHANGELOG.md).

## ✨ Fonctionnalités

- **Source Spotify** : connexion OAuth (écoutes récentes + genres) et import de
  vos exports de données (privacy / extended streaming history).
- **Pochettes automatiques** : les visuels manquants (surtout après un import)
  sont complétés via le **catalogue Spotify**.
- **Statistiques riches** : temps d'écoute, top titres / artistes / albums,
  genres pondérés, écoute quotidienne, répartition horaire, dernières écoutes.
- **Exploration** : pages détail **artiste** et **titre**, **recherche** dans la
  bibliothèque.
- **Récapitulatif (« Wrapped »)** : synthèse par année ou par mois avec
  comparaison à la période précédente, jour/heure les plus actifs et artistes
  découverts.
- **Export** : récapitulatif en **image PNG** (1080×1080) et **CSV** de tout
  l'historique.
- **Statut** : page de santé de l'instance (dernière synchro, écoutes du jour,
  statut des sources, taille de la base, activité récente).
- **Filtres** : par période (7 j → tout) et par source (Spotify, import).
- **Multilingue** : anglais (par défaut) et français, avec sélecteur de langue
  dans l'interface (dates et nombres localisés).
- **Tendances & heatmap** : heatmap annuelle façon GitHub et comparaison entre
  deux périodes (artistes en hausse / en baisse).
- **Découvertes** : page dédiée — obsessions du moment et artistes à
  redécouvrir.
- **Sauvegardes** : copie automatique de la base (rotation configurable) +
  endpoint dédié.
- **Déduplication robuste** : une écoute n'est jamais comptée deux fois.
- **Sessions sécurisées** : mots de passe `scrypt`, sessions JWT révocables,
  identifiants de sources chiffrés (AES-256-GCM).
- **Déploiement Docker** en une commande et **synchronisation automatique**.

## 🧱 Stack

| Élément | Choix |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19, Server Actions) |
| Langage | TypeScript |
| Base de données | SQLite via Prisma 7 + driver adapter `better-sqlite3` |
| UI | Tailwind CSS v4, composants maison, graphiques SVG sans dépendance |
| Auth | `jose` (JWT), `node:crypto` (scrypt, AES-GCM) |
| Image | `next/og` (récapitulatif PNG) |

## 🚀 Démarrage rapide (local)

Prérequis : **Node.js 22+** et **pnpm**.

```bash
# 1. Dépendances
pnpm install

# 2. Configuration
cp .env.example .env
openssl rand -base64 32   # -> SESSION_SECRET
openssl rand -base64 32   # -> CREDENTIALS_KEY

# 3. Base de données
pnpm db:push

# 4. (optionnel) jeu de données de démonstration
pnpm db:seed

# 5. Développement
pnpm dev        # http://localhost:3000
```

Le **premier compte créé devient administrateur**. En local, `pnpm db:seed`
crée un compte de démo (`demo@statisfy.local` / `statisfy123`) — à ne pas
conserver sur une instance publique.

### Production locale

```bash
pnpm build
pnpm start
```

## 🐳 Docker (recommandé)

```bash
cp .env.example .env
# Renseignez SESSION_SECRET et CREDENTIALS_KEY

docker compose up -d --build
```

- L'application est servie sur `http://localhost:3000`.
- La base SQLite est persistée via le montage `./prisma:/data`.
- Le schéma Prisma est appliqué automatiquement au démarrage.
- Un service **`cron`** appelle `POST /api/sync` **toutes les 2 minutes**
  (nécessite `SYNC_TOKEN`).

```bash
docker compose ps                  # état des services
docker compose logs -f statisfy    # journaux
docker compose up -d --build       # reconstruire après une modification du code
docker compose up -d               # recréer après une modification du .env
```

## ⚙️ Configuration

Toutes les variables sont documentées dans [`.env.example`](.env.example).

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | Chemin SQLite, ex. `file:./prisma/dev.db`. |
| `SESSION_SECRET` | Secret de signature des sessions (`openssl rand -base64 32`). |
| `CREDENTIALS_KEY` | Clé AES-256 (32 octets base64) pour chiffrer les identifiants. |
| `ALLOW_REGISTRATION` | `true`/`false` (surchargée depuis l'UI admin). |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Application Spotify. |
| `SPOTIFY_REDIRECT_URI` | Doit correspondre à une URL autorisée dans Spotify. |
| `APP_URL` | URL publique de l'interface (redirections derrière un proxy). |
| `COOKIE_DOMAIN` | Domaine partagé des cookies si UI et callback sont sur des sous-domaines distincts. |
| `SYNC_TOKEN` | Jeton protégeant `POST /api/sync` (utilisé par le cron). |
| `SYNC_MIN_INTERVAL_MS` | Intervalle minimal entre deux synchros déclenchées par l'API (défaut `120000`). |
| `BACKUP_KEEP` | Nombre de sauvegardes de la base conservées (défaut `7`). |

## 🎵 Source Spotify

### Connexion OAuth

1. Créez une application sur le
   [tableau de bord développeur Spotify](https://developer.spotify.com/dashboard).
2. Ajoutez une URL de redirection. Le chemin `/oauth/spotify/callback` est
   accepté (ainsi que `/api/sources/spotify/callback`), par exemple :
   - en local : `http://localhost:3000/oauth/spotify/callback`
   - en production : `https://statisfy.mondomaine.org/oauth/spotify/callback`
3. Renseignez `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` et
   `SPOTIFY_REDIRECT_URI`, puis redémarrez.
4. Dans **Réglages → Connecter Spotify**, cliquez sur *Connecter mon compte*.
5. Cliquez sur **Synchroniser** : écoutes récentes **et genres** sont récupérés.

> L'API Spotify ne renvoie que les 50 derniers morceaux. La synchronisation
> automatique (cron) évite d'en perdre ; pour l'historique complet, utilisez
> l'import ci-dessous.

### Importer l'historique Spotify

1. Demandez vos données sur
   [Spotify → Confidentialité](https://www.spotify.com/account/privacy/)
   (« Extended streaming history » recommandé).
2. Dans **Réglages → Importer un historique Spotify**, déposez l'archive `.zip`
   reçue de Spotify, ou les fichiers `Streaming_History_Audio_*.json`
   (jusqu'à 128 Mo par requête). Les pochettes manquantes sont ensuite
   complétées automatiquement.
3. L'import est **idempotent** : relancer un même fichier ne crée pas de doublon.

Pour les gros historiques (plusieurs années), préférez la ligne de commande ou
l'API HTTP (pas de limite navigateur) :

```bash
# en ligne de commande, sur le serveur où se trouve l'export
pnpm import:spotify-history ~/Téléchargements/my_spotify_data.zip --email vous@exemple.com

# via l'API (voir « POST /api/import/spotify-history » plus bas)
curl --user 'vous@exemple.com:motdepasse' \
  --data-binary @my_spotify_data.zip \
  https://mon-domaine/api/import/spotify-history
```

### Migration depuis *Your Spotify*

Deux méthodes pour récupérer l'historique de *Your Spotify* (MongoDB).

**A. Depuis l'interface (recommandé)** — via un dump :

1. Faites un dump de la base :
   ```bash
   mongodump --uri="mongodb://localhost:27017/your_spotify" --out=./ys-dump
   ```
2. Compressez le dossier en `.zip` (facultatif).
3. Dans **Réglages → Import from Your Spotify**, déposez les fichiers du dump
   (`infos`, `tracks`, `albums`, `artists`, en `.bson` ou `.json`) **ou** le
   `.zip`. Les genres et pochettes sont repris, l'import est idempotent.

**B. En ligne de commande** (connexion directe à MongoDB) :

```bash
MONGO_URL="mongodb://localhost:27017/your_spotify" \
  pnpm import:your-spotify --email vous@exemple.com
```

- `--mongo <url>` : URL MongoDB (sinon variable `MONGO_URL`).
- `--email <mail>` : compte Statisfy cible (sinon le plus ancien compte).
- `--limit <n>` : limiter aux n premières écoutes (test).

Dans les deux cas, l'import est **idempotent** (relancer ne crée pas de doublon).

> MongoDB 8 refuse de démarrer sur les noyaux Linux ≥ 6.19 (bug connu) : utilisez
> une image MongoDB 6 ou 7 si nécessaire.

## 🔌 API

| Route | Description |
| --- | --- |
| `GET /api/sync` | Synchronise les connexions dues. Auth : `Bearer $SYNC_TOKEN` ou session admin. |
| `POST /api/backup` | Sauvegarde la base SQLite. Auth : `Bearer $SYNC_TOKEN` ou session admin. |
| `POST /api/import/spotify-history` | Importe un export Spotify (`.zip` « Extended streaming history » ou `.json`). Auth : `Bearer $SYNC_TOKEN`, HTTP Basic ou session admin. |
| `POST /api/import/your-spotify` | Importe un dump *Your Spotify* (archive `.zip`) depuis un serveur. Auth : `Bearer $SYNC_TOKEN`, HTTP Basic (`-u email:motdepasse`) ou session admin. |
| `GET /api/export` | Export CSV de l'historique de l'utilisateur connecté. |
| `GET /api/wrapped/image` | Image PNG du récapitulatif (`?year=2026&month=10`). |
| `GET /oauth/spotify/callback` | Retour OAuth Spotify (à déclarer côté Spotify). |
| `GET /api/sources/spotify/start` | Démarre l'OAuth Spotify. |

Exemple de cron externe :

```bash
curl -X POST -H "Authorization: Bearer $SYNC_TOKEN" https://mon-domaine/api/sync
```

Importer un dump *Your Spotify* sans passer par le navigateur (utile quand le
serveur source n'est joignable qu'en SSH) :

```bash
# avec un compte standard (le plus simple)
curl -u 'vous@exemple.com:motdepasse' \
  --data-binary @ys-dump.zip \
  https://mon-domaine/api/import/your-spotify

# ou avec le jeton global
curl -X POST -H "Authorization: Bearer $SYNC_TOKEN" \
  --data-binary @ys-dump.zip \
  https://mon-domaine/api/import/your-spotify
```

Avec un compte standard, le dump est attribué à ce compte. Avec le jeton (ou une
session admin), il est attribué au premier administrateur ; utilisez
`?email=vous@exemple.com` pour cibler un autre compte. L'import est idempotent.

## 🗂️ Structure du projet

```
prisma/
  schema.prisma        # Modèles (User, Play, Track, Artist, Album, Job, ...)
  seed.ts              # Données de démonstration
src/
  app/                 # Routes : login, dashboard, top, wrapped, insights,
                       # history, status, search, artist/[id], track/[id],
                       # settings, api
  components/          # UI (cartes, graphiques SVG, navigation, formulaires)
  i18n/                # Dictionnaires (EN par défaut, FR) + helpers serveur
  lib/
    auth/              # Sessions, DAL, actions d'authentification
    sources/           # Adaptateur Spotify, import, enrichissement, état OAuth
    sync/              # Moteur d'ingestion idempotent + orchestration
    stats.ts           # Requêtes d'agrégation (dont tendances/découvertes)
    backup.ts          # Sauvegardes SQLite (VACUUM INTO + rotation)
    period.ts          # Périodes du récapitulatif
    crypto.ts          # Chiffrement des identifiants
    db.ts              # Client Prisma
```

### Ajouter une source

1. Implémentez `SourceAdapter` dans `src/lib/sources/`.
2. Enregistrez-la dans `src/lib/sources/registry.ts`.
3. Ajoutez le formulaire correspondant dans `src/app/(app)/settings`.

Le moteur (`src/lib/sync/`) gère le reste : déduplication, résolution des
entités, métadonnées et genres.

## 🗺️ Feuille de route

- Comparateur de deux périodes côte à côte.
- Format d'image « story » (1080×1920) pour le récapitulatif.
- Mode multi-utilisateurs avancé (partage de tableaux de bord).
- Tests automatisés + CI GitHub Actions.

## ⚖️ Licence et note légale

Statisfy est une **réécriture indépendante** : aucun code de *Your Spotify*
(licence GPL-3.0) n'a été copié. Le projet est distribué sous licence **MIT**
(voir [`LICENSE`](LICENSE)) — vous êtes libre de le modifier et de le
redistribuer.

Les conditions d'utilisation de l'API Spotify et le respect de ses marques
restent de votre responsabilité.
