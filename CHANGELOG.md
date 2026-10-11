# Journal des modifications

Toutes les évolutions notables de **Statisfy** sont documentées dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet suit le [versionnage sémantique](https://semver.org/lang/fr/).

## [Unreleased]

### Ajouté

- **Validation des accès Spotify** : en mode *Development*, Spotify limite
  l'application à une liste de comptes. Chaque utilisateur doit donc **demander
  l'accès** (Réglages → Connecter Spotify, en indiquant son compte Spotify) ;
  un administrateur **approuve ou refuse** la demande depuis la section
  « **Demandes d'accès Spotify** ». Tant qu'une demande est en attente, la
  connexion Spotify est bloquée — à la fois dans l'interface **et** sur la route
  OAuth (`/api/sources/spotify/start`) — tandis que l'**import d'historique**
  reste autorisé. Les administrateurs sont autorisés d'office, et les comptes
  ayant déjà une connexion Spotify restent valides.

- **Suivi des demandes Spotify** : **badge** dans la navigation pour
  l'administrateur, **statut** par compte (en attente / approuvé / refusé),
  **révocation** d'un accès approuvé (supprime la connexion et ses jetons),
  **annulation** de sa propre demande par l'utilisateur, **confirmation** avant
  suppression d'un compte, et **purge automatique** des invitations expirées ou
  consommées.

- **Partage public du récapitulatif** : depuis les **Réglages**, chaque
  utilisateur peut activer un **lien public en lecture seule** vers son
  récapitulatif (`/share/wrapped/<jeton>`), le **régénérer** ou le
  **désactiver**. Le jeton est opaque (192 bits), la page n'est pas indexée par
  les moteurs, et les liens internes vers les fiches artistes/titres sont
  neutralisés en mode public.

- **Tests** : nouveaux tests des flux récents (`rate-limit`, règles d'accès
  Spotify, mots de passe temporaires, bornes d'invitation) — **69 tests**.

- **Multi-utilisateur & gestion des comptes** : nouvelles sections
  administrateur dans les **Réglages** —
  « **Utilisateurs** » (liste des comptes avec nombre d'écoutes et de sources,
  promotion/retrait du rôle administrateur, **réinitialisation du mot de passe**
  avec mot de passe temporaire, suppression en cascade) et
  « **Invitations** » (génération de liens d'inscription, éventuellement
  restreints à une adresse e-mail, avec durée de validité et révocation). Un
  lien d'invitation valide permet de créer un compte **même lorsque les
  inscriptions publiques sont fermées**. Chaque compte peut aussi **changer son
  propre mot de passe** depuis **Réglages → Compte**.

- **Export de la base** : nouvelle section « Export » dans les **Réglages** —
  téléchargement de l'historique en CSV et de la **base SQLite complète** (`.db`)
  via `GET /api/export/db`. L'instantané est produit par `VACUUM INTO` (cohérent
  même base en cours d'utilisation) et le téléchargement est réservé aux
  administrateurs (la base contient tous les comptes et les identifiants
  chiffrés).

- **Comparateur de deux périodes** : nouvelle page « Comparateur » (`/compare`)
  pour opposer deux périodes (année entière ou mois précis) côte à côte —
  synthèse des écarts, graphique du temps d'écoute superposé et classements
  (artistes, titres, genres) en parallèle.
- **Image « story » du récapitulatif** : le récapitulatif peut être exporté en
  PNG vertical **1080×1920** (9:16), en plus du carré 1080×1080, via le paramètre
  `format=story` de `GET /api/wrapped/image`.
- **Tests automatisés** : **Vitest** avec des tests unitaires des helpers purs
  (`format`, `period`, `range`, `compare`, `password`, `crypto`), exécutés dans
  la CI via `pnpm test` (`pnpm test:watch` en local).
- **Page Tendances** (`/trends`) : comparaison de deux fenêtres consécutives
  (**7 j / 30 j / 90 j / 1 an**) pour les **artistes, titres et albums** en
  hausse et en baisse, avec un lien « toutes les tendances » depuis le tableau de
  bord. Le calcul (`computeTrends`) est un helper pur testé
  (`src/lib/trends.ts`).

### Retiré

- **Page Découvertes** (`/insights`) : page et entrée de menu supprimées ; ses
  tendances sont désormais couvertes par la page **Tendances**. La fonction de
  redécouvertes (`getRediscoveries`) est retirée avec elle.
- **Filtre de source** : le sélecteur « Spotify / Import » et la répartition par
  source sont retirés (toutes les écoutes viennent de Spotify). La provenance
  reste enregistrée et exportée en CSV.

### Corrigé

- **Image exportée du récapitulatif** : le pied de l'image n'affiche plus l'hôte
  de l'instance (`IP:port`), mais seulement le nom du compte et l'attribution
  Spotify.
- **Graphique « Écoute quotidienne » sur un seul jour** : un point unique était
  rendu comme une **aire triangulaire** pleine largeur ; il s'affiche désormais
  comme une **bande plate** avec le **libellé centré** (`AreaChart`).
- **Provenance des écoutes** : les imports de fichiers sont enregistrés avec la
  source `import` (et non plus `spotify` comme les synchros). Un script de
  rattrapage (`pnpm db:backfill-source`) corrige les bases existantes ; cette
  information reste visible dans l'export CSV.
- **Titres homonymes** : la résolution d'une piste tient désormais compte de
  l'**album**, évitant de fusionner deux titres de même nom du même artiste
  (studio/live, albums distincts).
- **Tendances** : le comparateur de la page Tendances et la carte du tableau de
  bord utilisent la période réellement sélectionnée (bornes calendaires) et non
  plus une fenêtre glissante.
- **Statistiques** : le jour et l'heure locale d'une écoute sont désormais
  calculés **par écoute** (avec cache) au lieu d'un décalage fixe. Corrige une
  heure d'écart pour les écoutes de la saison opposée dans les fuseaux à heure
  d'été (répartition horaire, écoute quotidienne, récapitulatif).
- **Graphique « Quand écoutez-vous ? »** : affiche désormais le **temps d'écoute
  moyen par jour actif** par heure locale (axe en durées) au lieu d'un cumul
  d'écoutes trompeur. Le graphique mensuel du récapitulatif profite aussi de
  l'échelle de durées (fin des millisecondes brutes sur l'axe).
- **Fond** : suppression de la « cassure » horizontale du dégradé décoratif au
  défilement. Les halos étaient peints dans la boîte du `<body>` limitée à la
  hauteur de la fenêtre (`height: 100%`) ; ils sont désormais fixés à la fenêtre
  (`position: fixed`) et la couleur de base porte sur `<html>`.
- **Durées** : l'unité « jour » est localisée (`j` en français, `d` en anglais)
  partout où une durée est affichée.

### Modifié

- **Intégration Spotify** : scopes réduits au strict nécessaire
  (`user-read-recently-played`), gestion des limites de débit (`Retry-After` +
  backoff exponentiel via `spotifyFetch`), remontée des messages d'erreur Spotify
  dans les retours utilisateur, redirect URI local en `127.0.0.1` (HTTPS
  obligatoire en production), et **attribution Spotify** ajoutée dans l'interface
  et les images exportées.
- **Docker** : l'image s'exécute désormais en **utilisateur non-root** (`node`)
  et n'embarque plus les dépendances de développement (`pnpm prune --prod`),
  réduisant sa taille.
- **Démarrage** : une sauvegarde de la base est créée avant `prisma db push`
  (3 dernières conservées) pour se prémunir d'une évolution de schéma.
- **Export CSV** : généré en **flux paginé** (pagination par curseur), la
  mémoire reste bornée quelle que soit la taille de l'historique.
- **Statut intégré aux Réglages** : les statistiques de la page « Statut »
  (écoutes du jour / de la semaine / totales, dernière synchro) et les
  informations système (uptime, taille de la base, sauvegardes, sync auto) sont
  désormais affichées dans la page **Réglages**. L'entrée « Statut » est retirée
  du menu et `/status` redirige vers `/settings`.
- **Tableau de bord** : les panneaux Top titres, Top artistes et Genres affichent
  désormais le **top 10** (au lieu de 5 / 5 / 8), harmonisé sur les trois.
- **Période par défaut** : le tableau de bord, les classements, l'historique et
  les pages artiste/titre s'ouvrent désormais sur **Aujourd'hui** (au lieu de
  « Tout »).
- **Vue d'ensemble** : le graphe « Écoute dans le temps » passe en **heures**
  quand la période couvre un seul jour (aujourd'hui) ; la carte « Quand
  écoutez-vous ? » est retirée (redondante).
- **Publication de l'image Docker désormais manuelle** : le workflow « Docker »
  ne se déclenche plus automatiquement (ni sur `main`, ni sur les tags de
  pré-version). Lancez-le à la main (Actions → *Docker* → *Run workflow*).
- **Build local par défaut** : `docker-compose.yml` construit l'image depuis les
  sources ; la ligne `image:` (GHCR) est commentée et optionnelle, et
  `STATISFY_IMAGE` est commentée dans `.env`/`.env.example`.

### Sécurité

- **Anti-SSRF sur les visuels distants** : `GET /api/wrapped/image` n'accepte
  plus que les URLs http(s) vers un hôte public (résolution DNS incluse) et
  refuse les adresses privées / loopback / lien-local ; il limite la taille
  (5 Mo) et le délai (5 s) de récupération et n'accepte que les `image/*`. Les
  imports « Your Spotify » pouvant contenir des URLs arbitraires, cela ferme un
  vecteur SSRF côté serveur.
- **En-têtes HTTP de sécurité** : `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `X-DNS-Prefetch-Control` et `Permissions-Policy` ajoutés à
  toutes les réponses.
- **Limite de taille** sur les endpoints d'import : `413` au-delà de 256 Mo
  (vérifié sur `Content-Length` puis sur le corps réel).
- **Anti force-brute** : limitation de débit sur la connexion (10 essais /
  15 min par couple IP + email, 30 / 15 min par IP) et sur l'inscription
  (5 / h par IP), avec message « trop de tentatives ».
- **Endpoints durcis** : le jeton `SYNC_TOKEN` n'est plus accepté en *query
  string*, `POST /api/backup` n'accepte plus `GET`, et les erreurs de sauvegarde
  ne renvoient plus de message interne brut.
- **CSV** : les cellules commençant par `=`, `+`, `-` ou `@` sont neutralisées à
  l'export (injection de formule tableur).
- **Archives** : décompression bornée (plafond par entrée et cumulé) contre les
  « zip bombs ».
- **OAuth** : la redirection de retour n'accepte plus que l'URL publique
  configurée ou l'origine de la requête courante (fin de la redirection ouverte
  via des en-têtes de proxy usurpés).
- **CSP avec nonce** : en production, `proxy.ts` (l'« ancien middleware » de
  Next 16) génère un **nonce par requête** et le pose sur la réponse **et** sur
  les en-têtes de requête, ce qui permet à Next d'associer ce nonce à ses
  scripts d'hydratation (`script-src 'self' 'nonce-…' 'strict-dynamic'`,
  **sans `'unsafe-inline'`**). Les routes API et les fichiers statiques sont
  exclus du proxy. Le CSP est désactivé en dev (Next y utilise `eval`).
- **Inscriptions** : consommation **atomique** des invitations (transaction) —
  une même invitation ne peut plus servir à deux inscriptions simultanées, et
  l'échec annule la création du compte. Un jeton invalide n'est plus bloquant
  lorsque les inscriptions publiques sont **ouvertes**. Durée de validité
  bornée (≤ 365 jours).
- **Mot de passe** : le changement est désormais **limité en débit**
  (anti force-brute du mot de passe courant) et révoque les sessions
  **autres que la session courante**.
- **Demandes d'accès Spotify** : **limitées en débit**, champ borné à 200
  caractères, et un compte déjà approuvé ne peut pas se rétrograder en attente.
- **Moindre privilège** : la liste des comptes et des invitations n'est
  chargée côté serveur que pour un **administrateur**.

## [0.11.0-preview.1] — 2026-10-10

> Version **preview** (pré-version) : image Docker
> `ghcr.io/lolo1580/statisfy:v0.11.0-preview.1` (et l'alias `:preview`).

### Ajouté

- **Image GHCR configurable** : variable `STATISFY_IMAGE` dans `.env`
  (documentée dans `.env.example`) et `docker-compose.yml` qui l'utilise
  (`image: ${STATISFY_IMAGE:-ghcr.io/lolo1580/statisfy:latest}`).

### Modifié

- Workflow Docker : tag d'image **`preview`** pour les tags de pré-version ;
  le tag `major.minor` n'est plus généré pour les pré-versions.

## [0.10.2] — 2026-10-10

### Ajouté

- **Publication de l'image Docker sur GHCR** : nouveau workflow GitHub Actions
  (`docker.yml`) qui construit et pousse une image multi-arch
  (`linux/amd64`, `linux/arm64`) sur `ghcr.io/lolo1580/statisfy` à chaque push
  sur `main` et chaque tag `v*`.

### Modifié

- `docker-compose.yml` : référence l'image GHCR (`image:`) en plus de
  `build:` ; README (EN/FR) mis à jour avec la section de récupération de
  l'image.

## [0.10.1] — 2026-10-10

### Modifié

- **Documentation** : le README principal passe en **anglais** (`README.md`) et
  une version **française** est ajoutée (`README.fr.md`), avec un lien de langue
  dans chacun.

## [0.10.0] — 2026-10-10

### Modifié

- **Licence** : passage de MIT à **GNU GPL v3.0** (copyleft). Voir
  [`LICENSE`](LICENSE) et le champ `license` de `package.json`.

## [0.9.8] — 2026-10-10

### Corrigé

- **Tableau de bord** : si la période ou la source sélectionnée ne contient
  aucune écoute alors que le compte en possède, un simple « Aucune donnée » est
  affiché au lieu de l'invitation à configurer une source.
- **Fuseaux horaires** : les débuts de jour / semaine / mois / année respectent
  désormais les changements d'heure (plus de décalage d'une heure).
- **Découvertes** : « ce mois-ci » se base sur le mois calendaire local (et non
  sur UTC).

## [0.9.7] — 2026-10-10

### Modifié

- **Graphique « Quand écoutez-vous ? »** repensé comme les courbes : axe vertical
  (comptage) et grille, libellés d'heures/mois intégrés et alignés sur les barres,
  et **infobulle au survol** (heure + valeur) avec mise en évidence de la barre.
  S'applique au Tableau de bord, à l'Historique et au Récapitulatif.

## [0.9.6] — 2026-10-10

### Ajouté

- **Bascule « Écoutes / Temps » sur la page Classements** (Top titres, Top
  artistes, Top albums), comme sur le Tableau de bord : switch par panneau qui
  change l'affichage **et le tri**, instantanément. Panneaux de classement
  mutualisés dans `src/components/ranking-panels.tsx`.

### Modifié

- **README** mis à jour : bascule écoutes/temps et graphiques interactifs.

## [0.9.5] — 2026-10-10

### Ajouté

- **Bascule « Écoutes / Temps »** sur les 3 panneaux du Tableau de bord (Top
  titres, Top artistes, Genres) : un switch par panneau qui change l'affichage
  **et le tri**, instantanément (côté client). Les genres disposent désormais
  aussi du temps d'écoute agrégé.

## [0.9.4] — 2026-10-10

### Modifié

- **Classements** : le nombre d'écoutes (`N×`) est remplacé par le **temps
  d'écoute** (min / h / j) sur le Tableau de bord, la page Classements, les pages
  Artiste et Titre, le Récapitulatif, les Découvertes et la Recherche.
  `formatDuration` affiche désormais aussi les jours (ex. « 2 j 5 h »).

## [0.9.3] — 2026-10-10

### Corrigé

- **Graphe « Évolution de l'écoute » en mode « Tout »** : il n'affichait que les
  90 derniers jours à cause d'une fenêtre par défaut. Il couvre désormais tout
  l'historique, depuis la première écoute. Le graphe horaire agrège lui aussi
  tout l'historique dans ce mode.

## [0.9.2] — 2026-10-10

### Modifié

- **Graphique « Évolution de l'écoute »** repensé : grille horizontale et axe
  vertical des durées (échelle arrondie), plusieurs libellés de dates sur l'axe
  X, et **infobulle au survol** (réticule, point, date complète + durée). Les
  graphiques des pages Artiste, Titre et Récapitulatif en bénéficient aussi.

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
