# Journal des modifications

Toutes les évolutions notables de **Statisfy** sont documentées dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet suit le [versionnage sémantique](https://semver.org/lang/fr/).

## [0.9.1] — 2026-10-10

### Modifié

- **Sélecteur de période simplifié (tout calendaire)** :
  `Aujourd'hui · Semaine · Mois · Année · Tout`, dans le fuseau du compte. Les
  fenêtres glissantes `7 j / 30 j / 90 j / 1 an` faisaient doublon avec
  Semaine/Mois et sont retirées. Les anciennes URL (`?range=7`, etc.) restent
  fonctionnelles.

## [0.9.0] — 2026-10-10

### Ajouté

- **Import de l'historique Spotify complet** : la section « Importer un
  historique Spotify » accepte désormais l'archive `.zip` livrée par Spotify
  (« Extended streaming history »), en plus des fichiers `.json`. Nouvel
  endpoint `POST /api/import/spotify-history` et commande
  `pnpm import:spotify-history` (fichier ou dossier) pour les gros historiques.
  Les podcasts sont ignorés ; l'import reste idempotent.
- **Filtres « Cette semaine » et « Ce mois »** dans les sélecteurs de période
  (semaine ISO à partir du lundi, mois calendaire), en complément de
  « Aujourd'hui ».

### Modifié

- L'authentification des endpoints d'import (jeton `SYNC_TOKEN`, HTTP Basic ou
  session admin) est factorisée dans un helper partagé
  (`src/lib/api/import-target.ts`).

## [0.8.0] — 2026-10-10

### Ajouté

- **Filtre « Aujourd'hui »** dans les sélecteurs de période (Tableau de bord,
  Classements, Historique, pages Artiste et Titre) : compte les écoutes depuis
  minuit dans le fuseau horaire du compte, et limite le graphique journalier à
  la journée en cours.

## [0.7.0] — 2026-10-10

### Ajouté

- **Prise en charge des écrans très larges (21:9 / 32:9)** : nouveaux points de
  rupture Tailwind `3xl` (1920 px) et `4xl` (2560 px). Le conteneur s'élargit
  progressivement jusqu'à 2000 px et plusieurs grilles se densifient sur
  ultra-large : classements du Tableau de bord en 3 colonnes, Réglages et
  Découvertes sur 2 colonnes.

## [0.6.0] — 2026-10-10

### Ajouté

- **Import *Your Spotify* par HTTP** : nouvelle route
  `POST /api/import/your-spotify` acceptant l'archive `.zip` du dump
  (`Authorization: Bearer $SYNC_TOKEN`, **HTTP Basic** `-u email:motdepasse`,
  ou session admin). Permet d'importer depuis un serveur joignable uniquement en
  SSH — sans upload navigateur ni transfert de fichier. Avec un compte standard
  le dump lui est attribué ; avec le jeton, il va au premier administrateur (ou
  `?email=`). Import idempotent.

## [0.5.0] — 2026-10-10

### Modifié

- **Enrichissement des visuels** : remplacement de l'API Deezer par le
  **catalogue Spotify** (flux `client_credentials`, réutilise
  `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET`). Plus aucune dépendance à un
  service tiers autre que Spotify.

## [0.4.0] — 2026-10-10

### Ajouté

- **Migration depuis *Your Spotify*** : import de la base MongoDB
  (`artists`, `albums`, `tracks`, `infos`) — genres et pochettes inclus, de
  façon idempotente. Deux voies : **depuis l'interface** (upload des fichiers du
  dump `.bson`/`.json` ou d'un `.zip`) et **en ligne de commande**
  (`pnpm import:your-spotify`). Lecture BSON/JSON isolée dans
  `src/lib/sources/your-spotify.ts`.

## [0.3.0] — 2026-10-10

### Ajouté

- **Tendances** : comparaison de deux périodes consécutives (artistes en hausse
  / en baisse) et carte dédiée sur le tableau de bord.
- **Heatmap annuelle** façon GitHub (une case par jour) sur la page Historique.
- **Page Découvertes** : obsessions du moment (hausses sur 30 jours) et
  artistes à redécouvrir (aimés mais délaissés depuis 90 jours).
- **Sauvegardes automatiques** de la base SQLite (`VACUUM INTO` + rotation),
  endpoint `POST /api/backup`, tâche planifiée (toutes les 6 h) et affichage du
  nombre de sauvegardes sur la page Statut.

## [0.2.0] — 2026-10-10

### Ajouté

- **Internationalisation** : anglais (par défaut) et français ; **sélecteur de
  langue** dans l'interface (cookie), dates, nombres et image du récapitulatif
  localisés. Toutes les chaînes ont été extraites dans `src/i18n/`.

## [0.1.0] — 2026-10-10

Première version fonctionnelle et déployée.

### Ajouté

- **Socle applicatif** : Next.js 16 (App Router, React 19, Server Actions),
  TypeScript, Prisma 7 sur SQLite (driver adapter `better-sqlite3`),
  Tailwind CSS v4.
- **Authentification locale** : hachage des mots de passe en `scrypt`,
  sessions JWT signées et révocables en base, chiffrement AES-256-GCM des
  identifiants de sources. Le premier compte créé devient administrateur.
- **Source Spotify (OAuth)** : synchronisation des écoutes récentes, du
  contexte et des genres (enrichissement via `/v1/artists` en appel groupé),
  rafraîchissement automatique du jeton, état OAuth signé.
- **Import d'historique** : prise en charge des exports Spotify
  *Extended streaming history* et de l'ancien format (`StreamingHistory*.json`),
  en JSON ou JSONL.
- **Moteur d'ingestion idempotent** : clé de déduplication stable, table de
  correspondance `ExternalRef`, résolution/mise en cache des artistes, albums et
  pistes, insertion par lots.
- **Enrichissement des visuels** : complétion des pochettes d'albums et des
  photos d'artistes manquantes via l'API publique Deezer (sans clé), y compris
  après un import.
- **Tableau de bord** : temps d'écoute, top titres / artistes / albums, genres
  pondérés, écoute quotidienne (SVG), répartition horaire, dernières écoutes.
- **Exploration** : pages détail **artiste** et **titre** (historique, albums,
  sources, écoutes récentes), **recherche** dans la bibliothèque.
- **Filtres** : par période (7 j → tout) et par source, sur toutes les vues.
- **Récapitulatif (« Wrapped »)** : synthèse par année ou par mois (temps
  d'écoute, tops, genres, jour et heure les plus actifs, artistes découverts)
  avec comparaison à la période précédente.
- **Export** : récapitulatif téléchargeable en **image PNG** (1080×1080, via
  `next/og`) et export **CSV** de l'historique.
- **Page Statut** : dernière synchro, écoutes du jour / de la semaine, statut
  des sources, taille de la base, environnement et activité récente.
- **API & automatisation** : endpoint `POST /api/sync` protégé par jeton, cron
  Docker (toutes les 2 min) et seuil anti-rafale configurable.
- **Docker** : `Dockerfile` multi-étapes et `docker-compose.yml` ; l'entrypoint
  applique le schéma Prisma au démarrage.
- **Démonstration** : script `pnpm db:seed` (compte et écoutes de test).

### Modifié

- Recentrage du projet sur **Spotify uniquement** après une première version
  multi-sources ; l'abstraction `SourceAdapter` a été conservée pour permettre
  l'ajout d'autres sources plus tard.
- Les synchronisations sans nouvelle écoute ne créent plus d'entrée dans la
  table des jobs (cron fréquent).
- Redirections OAuth rendues fiables derrière un reverse proxy
  (`APP_URL` + en-têtes `X-Forwarded-Host` / `X-Forwarded-Proto`).

### Corrigé

- Adaptation complète à **Prisma 7** : générateur `prisma-client`, configuration
  `prisma.config.ts`, driver adapter SQLite, absence de `--skip-generate`.
- État OAuth rendu vérifiable quel que soit l'hôte (jeton signé au lieu d'un
  simple cookie), corrigeant les configurations où l'UI et le callback sont sur
  des domaines distincts.
- Construction de l'image Docker : schéma copié avant le `postinstall`,
  installation d'OpenSSL, `DATABASE_URL` de compilation, entrypoint sans
  téléchargement de pnpm (corepack) au démarrage.

### Retiré

- Intégration **Last.fm** (adaptateur, interface, variables d'environnement et
  documentation), remplacée par la source Spotify.

### Sécurité

- Suppression du compte de démonstration sur l'instance publique.
- Fermeture des inscriptions (`allow_registration = false`), activable depuis
  l'interface d'administration.
