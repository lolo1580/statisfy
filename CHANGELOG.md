# Journal des modifications

Toutes les évolutions notables de **Statisfy** sont documentées dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet suit le [versionnage sémantique](https://semver.org/lang/fr/).

## [Unreleased]

### Modifié

- **Performance** : cache mémoire TTL (60 s par défaut, réglable avec
  `STATS_CACHE_TTL_MS`) sur les agrégations des pages en lecture seule
  (tableau de bord, historique, comparateur, récapitulatif, fiches, partages,
  images Open Graph). Les chargements concurrents sont dédupliqués et le cache
  est invalidé par utilisateur après chaque synchronisation ou import (et
  globalement après un recalcul du seuil d'écoute).

## [1.2.0] — 2026-10-28

### Ajouté

- **Palette de commandes (`⌘K` / `Ctrl+K`)** : navigation rapide vers les
  pages, l'administration et la documentation, avec recherche directe dans la
  bibliothèque.
- **Notifications toast** : retour global pour les copies de liens et les
  actions RUM, avec empilement et fermeture automatique.
- **Données personnelles en onglets** : export, partage (récap + profil public),
  API et zone de danger sont désormais séparés par section.
- **QR codes de partage** : génération serveur d'un QR code pour les liens du
  récapitulatif et du profil public.
- **PWA** : manifeste installable, icônes générées (192/512/apple) et mode
  `standalone` (sans cache hors ligne pour ne pas exposer de données privées).
- **Période mémorisée** : la dernière plage choisie (`today`, `week`, `month`,
  `year`, `all` ou un nombre de jours) est conservée dans un cookie et réutilisée
  sur toutes les pages (tableau de bord, historique, artistes, titres) quand
  aucun `?range=` n'est présent.
- **Aperçu social du wrapped** : les pages partagées exposent désormais des
  métadonnées Open Graph/Twitter et une image 1200×630 générée par
  `/api/wrapped/og` (nom, période, temps d'écoute, écoutes, top artiste/titre).
- **Real User Monitoring (SDK OpenObserve)** : intégration des SDK navigateur
  `@openobserve/browser-rum` et `@openobserve/browser-logs` (sessions, vues, Core
  Web Vitals, logs et erreurs), configurables depuis **Administration →
  Instance** (URL, organisation, jeton, échantillonnage, confidentialité,
  trackers, replay, logs) et désactivables via l'interface ou
  `OPENOBSERVE_RUM_ENABLED=false`. Les événements passent par un relais
  same-origin `/api/rum` : le jeton reste côté serveur et le CSP demeure
  `connect-src 'self'`. Valeurs par défaut orientées vie privée
  (`mask-user-input`, persistance mémoire, replay désactivé), DNT/GPC respectés.
- **Profil public** : page en lecture seule (opt-in) `/share/profile/<jeton>`,
  avec sections au choix (top artistes, top titres, dernières écoutes, heatmap
  annuelle) et sélecteur de période. Jeton révocable depuis « Données
  personnelles ».
- **Carte SVG & webhooks** : badge SVG intégrable
  (`/api/public/stats/card.svg`) et notifications sortantes Discord, ntfy,
  Home Assistant ou n8n à la fin d'une synchronisation ou d'un import, avec
  signature HMAC-SHA256 facultative.
- **Prisma Migrate & tests E2E** : le schéma est désormais versionné dans
  `prisma/migrations` (baseline de la v1.1.1 + migration courante, baseline
  automatique des bases existantes au démarrage du conteneur). Les parcours
  critiques (inscription, API, carte, profil public) sont couverts par
  Playwright (`pnpm test:e2e`).
- **API publique de statistiques** : `GET /api/public/stats` expose en lecture
  seule les agrégats d'un compte (période paramétrable, totaux, fenêtres
  aujourd'hui / 7 j / 30 j, top artiste et piste) pour alimenter un widget de
  tableau de bord (ex. Homepage `customapi`). Jeton propre au compte, activé ou
  révoqué depuis « Données personnelles », utilisable en `Authorization: Bearer`
  ou en `?token=`. Limiteur de débit et cache court inclus.
- **Documentation Swagger** : page `/api-docs` (Swagger UI servi localement,
  sans CDN) et spécification OpenAPI 3.1 sur `/api/docs/openapi.json`, couvrant
  les routes publiques, d'import, d'export et d'administration.
- **Suppression autonome du compte** : depuis « Données personnelles », chaque
  personne peut supprimer définitivement son compte (confirmation explicite +
  mot de passe, sessions et données supprimées en cascade, dernier
  administrateur protégé). Redirection vers la connexion avec un message de
  confirmation.
- **Progression des imports** : une barre de progression suit l'import en temps
  réel (`Job` + `GET /api/jobs/<id>`, interrogé toutes les 2 s), avec un état
  indéterminé pendant l'analyse du fichier puis « n / total écoutes ».
- **Pages d'erreur et de chargement** : frontières `error.tsx` (shell et
  racine), `global-error.tsx`, `not-found.tsx` localisées, et un squelette
  `loading.tsx` pendant la navigation — plus de page d'erreur générique de Next
  ni de 404 sans navigation.
- **Export CSV enrichi** : l'historique exporté inclut désormais le contexte,
  la plateforme, le pays, les indicateurs `skipped` / `shuffle` / `offline` /
  `incognito` et les raisons de début/fin d'écoute.
- **Recherche indexée** : index GIN trigrammes sur `Artist.name` et
  `Track.name` (`prisma/indexes.sql`, `pnpm db:indexes`, rejoué au démarrage du
  conteneur) — les recherches `%motif%` ne font plus de parcours complet.
- **Import d'historique** : lien direct vers la page « Confidentialité » de
  Spotify pour demander l'« historique d'écoute étendu » (`Extended streaming
  history`). Le sélecteur de langue passe de menu déroulant à des **boutons
  EN/FR**, dans le même style que le sélecteur de thème.
- **Thème clair / sombre** : les couleurs sont désormais des jetons
  (`--background`, `--surface`, `--accent`, `--on-accent`, `--danger`…) résolus
  selon `color-scheme`, avec `light-dark()` (repli sombre pour les navigateurs
  non compatibles). Un sélecteur **Système / Clair / Sombre** (shell et pages de
  connexion/inscription) mémorise le choix dans un cookie relu au rendu serveur —
  donc aucun flash. En « Système », `prefers-color-scheme` prend le relais.
- **Mises à jour optimistes** : les listes d'**invitations**, de **comptes**
  (rôle admin, suppression), de **sources connectées** et des **demandes
  d'accès Spotify** (approbation/refus avec réordonnancement, révocation)
  réagissent immédiatement (création avec identifiant temporaire, bascule de
  statut, suppression), affichent un indicateur discret pendant la
  synchronisation et **reviennent en arrière** si le serveur refuse (dernier
  admin, session expirée…). Primitives réutilisables dans
  `src/lib/optimistic.ts` et le hook `useOptimisticList`
  (`src/components/optimistic.tsx`) ; les Server Actions concernées renvoient
  désormais un résultat `{ ok, error }` pour signaler les échecs.
- **Redécouvertes, records & habitudes d'écoute** : le tableau de bord gagne une
  section **Redécouvertes** (artistes écoutés autrefois puis délaissés, à
  réécouter) et une bande **Records & séries** (série en cours, meilleure série,
  jours actifs, journée la plus intense). La page Historique gagne une
  **heatmap 7×24** (jour de la semaine × heure locale) et, pour les historiques
  **étendus** importés, une carte **Habitudes d'écoute** (taux d'écoutes
  zappées, mode aléatoire, hors ligne, appareils les plus utilisés). Nouvelles
  colonnes `Play` renseignées à l'import : `platform`, `country`, `skipped`,
  `shuffle`, `offline`, `incognito`, `reasonStart`, `reasonEnd` (l'export
  classique et la sync live ne les fournissent pas). ⚠️ Les écoutes déjà en base
  ne sont pas rétro-remplies par un simple réimport (la déduplication les
  ignore) : `pnpm db:backfill-play-metadata <export.zip>` renseigne ces colonnes
  sans réimporter.

### Modifié

- **Performance des agrégations** : les entités distinctes du tableau de bord
  sont comptées par PostgreSQL (`COUNT(DISTINCT …)`) au lieu de rapatrier tous
  les triplets (artiste, piste, album) ; les records sont calculés à partir des
  jours actifs agrégés directement dans le fuseau local (fini la relecture de
  toutes les tranches de 15 min de l'historique complet) ; nouvel index
  composite `Play (userId, counted, playedAt)`.
- **Accessibilité** : le dialogue de bienvenue piège désormais le focus, se
  ferme avec `Échap` et restitue le focus ; les graphiques en aire et de
  comparaison sont focusables et navigables au clavier (flèches, `Début`,
  `Fin`), avec annonce des valeurs via une région `aria-live`.
- **Historique** : les dernières écoutes sont paginées par paliers de 50
  (« Afficher 50 de plus », plafond 500) au lieu d'être figées à 50.
- **Qualité** : Prettier (`.prettierrc.json`, `pnpm format` /
  `pnpm format:check`, vérification en CI), seuils de couverture Vitest,
  test de parité des dictionnaires en/fr, `SECURITY.md` et `CONTRIBUTING.md`,
  version Node minimale déclarée (`engines`), image `curlimages/curl` épinglée.
- **Export du récapitulatif** : les deux formats d'image (carré 1:1 et story
  9:16) sont regroupés dans un menu déroulant. Une entrée « Partager sur
  Instagram » utilise la feuille de partage native (image story prête à
  publier) ; sans partage de fichiers, l'image est téléchargée/copiée et
  Instagram est ouvert. Préchargement de l'image à l'ouverture du menu pour
  préserver l'activation utilisateur.
- **Redécouvertes** : la section classe désormais les artistes délaissés par un
  score qui combine affection (nombre d'écoutes, en racine carrée), silence
  (ancienneté de la dernière écoute, plafonné), longévité de la relation et
  régularité (mois actifs distincts). Filtrage `HAVING` en SQL, diversité des
  genres principaux, et affichage « X écoutes · il y a … » sur le tableau de
  bord.
- **Découpage des gros modules** : `src/lib/stats.ts`, `src/lib/log-sink.ts`,
  `src/lib/api/openapi.ts` et `src/components/charts.tsx` deviennent des
  barrels ; l'implémentation est répartie par domaine (`stats/*`, `log-sink/*`,
  `api/openapi/*`, `charts/*`). Les imports existants restent inchangés.
- **Sécurité (CSP)** : `img-src` n'autorise plus tout HTTPS mais uniquement les
  CDN Spotify (`*.scdn.co`, `*.spotifycdn.com`) ; ajout de `media-src`,
  `manifest-src`, `frame-src 'none'` et, en HTTPS uniquement,
  `upgrade-insecure-requests`.
- **API publique** : les erreurs sont localisées selon `Accept-Language`
  (français/anglais) et exposent un `code` stable (`unauthorized`,
  `rate_limited`, `invalid_range`). Une période invalide renvoie désormais
  `400` au lieu d'être silencieusement remplacée par 30 jours.
- **Tests** : couverture OpenAPI (routes publiques et résolution des `$ref`),
  messages d'erreur localisés, et vérifications e2e des en-têtes CSP et des
  erreurs d'API.
- **Durcissement RUM** : SDK chargé uniquement dans l'espace authentifié,
  URLs normalisées (query/hash/IDs/jetons), URLs `/settings` et `/admin`
  rédigées et leurs logs ignorés, replay mis en pause sur ces pages, relais
  `/api/rum` limité aux requêtes same-origin et corps plafonnés (256 Ko
  RUM/logs, 5 Mo replay).
- **Dépendances** : Next.js **16.4.0 → 16.4.2** (correctif de sécurité qui
  bloquait `next build`), `eslint-config-next` aligné, et
  `experimental.agentUpgrade` réglé sur `security`.
- **Tableau de bord** : les classements « écoutes » et « temps » de chaque
  entité sont calculés en **une seule agrégation** (fonctions de fenêtrage
  PostgreSQL) au lieu de deux, et les entités ne sont lues qu'une fois.
- **Sécurité** : en-tête `Strict-Transport-Security` (HSTS) et limitation de
  débit sur la génération d'images du récapitulatif (`/api/wrapped/image`).
- **Tests** : couverture de `src/lib/stats.ts` (agrégations, fuseaux, genres,
  redécouvertes, habitudes, classements doubles) ; `pnpm test:coverage` et le
  rapport de couverture sont exécutés en CI.

### Corrigé

- **Limitation de débit** : l'API publique de statistiques et le relais RUM ne
  créent plus de seau partagé « local » quand l'IP n'est pas déterminable (tous
  les clients anonymes tombaient sinon dans la même limite, avec un risque de
  blocage global). La limite par compte reste appliquée à l'API.

### Supprimé

- **Pages Classements (`/top`) et Tendances (`/trends`)** : supprimées, ainsi
  que leurs entrées de navigation et la carte « Tendances » du Tableau de bord.
  Les classements restent disponibles sur le Tableau de bord et le Comparateur.
  Le code associé (`getTrends`/`getArtistTrends` dans `stats.ts`, helper
  `computeTrends` dans `src/lib/trends.ts`) est retiré.

## [1.1.1] — 2026-10-16

### Ajouté

- **Seuil de comptabilisation des écoutes (3/4)** : une écoute ne compte dans
  les statistiques que si au moins **3/4 de la piste** a été écouté (colonne
  `Play.counted`, calculée à l'ingestion ; durée inconnue → comptée). Les
  écoutes trop courtes restent stockées et visibles dans l'export, mais sont
  exclues des agrégations, classements, graphiques et tendances. Règle définie
  dans `src/lib/play-counting.ts`. Pour recalculer l'existant :
  `pnpm db:backfill-counted`.

### Corrigé

- **Import Spotify** : les horodatages de l'export classique (`endTime`, sans
  fuseau) sont désormais lus en **UTC** (et non en heure locale du serveur) ; un
  fuseau explicite reste respecté.
- **Import « Your Spotify »** : les dates Extended JSON de `mongoexport`
  (`{ "$date": … }`) sont normalisées (avant, toutes les écoutes d'un dump JSON
  étaient ignorées) ; un **fichier isolé** (non zippé) est accepté via l'en-tête
  `X-Filename`/`Content-Disposition` ou la détection du premier document.
- **Gros imports** : plus de `push(...documents)` (dépassement de pile V8 sur
  les historiques volumineux) — insertion par boucle.
- **Import/sync** : course à la création d'un **artiste** ou d'un **album**
  partagé entre deux imports concurrents gérée (relit l'entité au lieu d'avorter
  le lot) ; les noms sont normalisés (`trim`) avant résolution, évitant les
  entités « fantômes ».
- **Sync Spotify** : un jeton OAuth rafraîchi est désormais **persisté même si
  le fetch/ingest échoue** (évite de perdre un refresh token tourné).
- **Statistiques** : le classement des **genres** agrège tous les artistes
  écoutés (fini le plafond des 100 artistes les plus écoutés qui faussait le
  classement).
- **CLI `import:your-spotify`** : la connexion MongoDB est fermée même en cas
  d'erreur.

### Sécurité / robustesse (2ᵉ passe)

- **Déduplication** : la clé d'écoute est calculée **à la seconde** (au lieu des
  millisecondes), si bien qu'une même écoute synchronisée puis importée n'est
  plus comptée deux fois. Nouveau rattrapage : `pnpm db:normalize-dedup`
  (supprime les doublons existants et réécrit les clés).
- **`SESSION_SECRET`** : longueur minimale de **32 octets** imposée (le secret
  signe les sessions HS256 et le `state` OAuth).
- **Rate-limit** : une IP indéterminable ne crée plus de seau **global** partagé
  par tous les clients (fini le blocage de connexion global) ; les seaux encore
  actifs ne sont plus évincés par un flood de clés (contournement fermé).
- **Statistiques** : les tranches temporelles SQL sont **tronquées** à la
  seconde (`floor`) au lieu d'être arrondies ; les tendances respectent le
  périmètre (artiste/titre/album) ; la recherche est insensible à la casse.
- **`/api/restore`** : lecture du corps **bornée en streaming** (plus de
  chargement intégral en mémoire avant le contrôle de taille).

### Classements & auth (3ᵉ passe)

- **Tri « écoutes / temps »** : le classement affiché est désormais calculé
  **côté serveur** pour chaque métrique (vrais tops par temps d'écoute, plus un
  simple re-tri du top par écoutes). Concerné : Tableau de bord, Classements,
  Comparateur, fiches artiste et récapitulatif.
- **Auth** : le hash scrypt factice (anti-oracle temporel sur l'existence d'un
  compte) s'applique aussi à l'**authentification HTTP Basic** des imports ;
  le **mot de passe du compte de démo** n'est plus un mot de passe par défaut
  connu (généré aléatoirement, ou via `SEED_PASSWORD`) ; les **sessions
  expirées** sont purgées à la connexion.

### Maintenance & données (4ᵉ passe)

- **Purge hors GET** : le nettoyage de rétention des journaux et des invitations
  n'est plus déclenché pendant le rendu (GET) des pages admin ; il est exécuté
  par le **cron** (`/api/sync`), supprimant toute mutation déclenchable par une
  simple navigation.
- **Bornes du récapitulatif** : les tranches journalières/mensuelles du Wrapped
  sont calculées en **UTC**, alignées sur la période : plus de jour/mois hors
  période (frontière de fuseau) et cohérence avec les totaux affichés.
- **Genres dédoublonnés** au stockage comme à la lecture (un genre présent deux
  fois n'est plus compté doublement).
- **`/api/export/db`** : filet de sécurité qui supprime le dump temporaire même
  si le flux n'émet jamais `close`.

### Seuil d'écoute (5ᵉ passe)

- **Seuil configurable** : le seuil de comptabilisation (3/4 par défaut) est
  réglable depuis **Administration → Instance** ; l'enregistrer **recalcule**
  `counted` sur toutes les écoutes.
- **Durées de piste enrichies** : à l'import d'un export Spotify sans durée, les
  durées manquantes sont récupérées via le catalogue Spotify, puis le seuil est
  réappliqué — le seuil est donc effectif aussi pour ces imports.
- **Taux d'écoute complète** : la page *Activité* affiche la part d'écoutes ayant
  atteint le seuil.

### Ops & performance (6ᵉ passe)

- **Healthcheck Docker** sur le service `statisfy` (état `healthy` fiable).
- **Sauvegardes auto-vérifiées** : chaque dump est relu (`pg_restore --list`)
  juste après sa création ; un dump corrompu est supprimé et signalé.
- **Gardes-fous CI** : à chaque push/PR, l'image Docker est **construite puis
  démarrée** contre Postgres (smoke test `GET /login`), et un test de **mise à
  niveau** démarre la nouvelle image sur une base créée avec le schéma de la
  **release précédente** — attrape les pannes de build Docker et de
  démarrage/entrypoint, ainsi que les régressions « vieille instance → nouvelle
  version » (colonnes/tables manquantes). Les tags `v*` sont protégés
  (suppression/force-update interdits).

> Schéma : on conserve `prisma db push` au démarrage (et non `prisma migrate`).
> Une instance existante peut être à une version ancienne quelconque ; `db push`
> réconcilie le schéma (tables/colonnes manquantes) de façon robuste, là où une
> migration de référence supposerait un schéma de départ connu.

### Modifié

- **Image Docker allégée** : build en **sortie auto-portée**
  (`output: "standalone"`) — le serveur n'embarque plus que les dépendances
  réellement utilisées, au lieu de tout `node_modules`. L'image de production
  passe d'environ **1,5 Go à ~850 Mo**. Le CLI Prisma, requis par l'entrypoint
  pour `db push`, est installé dans un préfixe isolé (`/app/prisma-cli`), et le
  serveur démarre via `node server.js`.

## [1.1.0] — 2026-10-14

### Ajouté

- **Journal d'événements** : nouvelle table `LogEntry` et page **`/admin/logs`**
  listant l'activité de l'instance (authentification, actions d'administration,
  connexions OAuth Spotify, échecs de synchronisation/import, restauration) avec
  filtres par **niveau**, **origine**, **plage de dates (du/au, fuseau du compte)**
  et recherche plein texte. **Export CSV et JSON** via
  `GET /api/admin/logs/export` (session admin ou `Bearer $SYNC_TOKEN`), paginé et
  filtrable, et bouton **« Vider le journal »** (avec confirmation). Rétention
  configurable par `LOG_RETENTION_DAYS` (défaut 90 jours, `0` = illimité), purgée
  à l'ouverture de la page.

- **Redirection des logs vers un serveur externe** : chaque événement peut être
  transmis en plus de l'écriture en base, via des protocoles standards (sans
  dépendance npm) : **GELF HTTP/UDP/TCP** (Graylog, Logstash, Fluent Bit…),
  **Syslog RFC 5424 UDP/TCP**, **JSON générique via HTTP** (SaaS, endpoint
  maison), **Grafana Loki** (API push), **Elasticsearch/OpenSearch** (API
  bulk), **OpenTelemetry/OTLP HTTP** (SigNoz, otel-collector) et **fichier NDJSON
  local** (agent Wazuh, rotation incluse, format `json` ou `raw`). Configuration
  par `LOG_SINK`
  (+ `LOG_SINK_URL`, `LOG_SINK_HEADERS`, `LOG_SINK_INDEX`, `LOG_SINK_LABELS`,
  `LOG_SINK_FILE`) avec **TLS optionnel** sur les transports TCP
  (`LOG_SINK_TLS*`). Envoi **best-effort** et asynchrone (file bornée,
  connexion TCP persistante rétablie en cas d'échec) qui ne bloque jamais les
  requêtes, seuil de niveau configurable (`LOG_SINK_MIN_LEVEL`), et bouton
  **« Tester l'envoi »** dans `/admin/logs`.

- **Espace d'administration dédié** (`/admin`) : chaque domaine a désormais sa
  propre page — **Vue d'ensemble** (compteurs + état système), **Utilisateurs**,
  **Invitations**, **Accès Spotify** et **Instance** (inscriptions, sauvegarde &
  restauration). L'accès est réservé aux comptes administrateurs (contrôle
  serveur dans le layout, redirection des autres comptes vers le tableau de
  bord). Un lien **Admin** avec compteur de demandes en attente apparaît dans la
  navigation.

### Sécurité

- **Dépendances** : `pnpm.overrides` épinglant les versions corrigées des
  transitifs vulnérables du CLI Prisma (`lodash` 4.18.1, `mysql2` 3.24.5,
  `deepmerge-ts` 8.0.2). `pnpm audit --prod` ne remonte plus aucune
  vulnérabilité ; le CLI Prisma (`db push`, `generate`) reste fonctionnel.
- **Injection de logs** : neutralisation des retours ligne et caractères de
  contrôle dans les sinks *ligne par ligne* (syslog, fichier `raw`) — empêche la
  forge de fausses entrées côté SIEM.
- **Limiteur de débit** : bornage mémoire (éviction des plus anciens) en cas de
  flood de clés distinctes.
- **`GET /api/sync`** : n'accepte plus la session (cookie) — jeton `Bearer`
  uniquement, pour éviter un déclenchement par navigation.
- **Bandeau de notification** : seules les valeurs connues sont affichées
  (plus de reflet arbitraire d'un paramètre d'URL).
- **Rotation de session** : le changement de mot de passe détruit toutes les
  sessions puis en ouvre une nouvelle (le jeton change).
- **En-têtes de proxy** : `X-Forwarded-For` / `X-Real-IP` sont désormais validés
  comme adresses IP réelles (sinon « local »), sans retomber sur un saut forgé
  par le client.
- **Surveillance des dépendances** : étape `pnpm audit --prod --audit-level high`
  dans la CI et configuration **Dependabot** (npm/pnpm + GitHub Actions,
  hebdomadaire, mises à jour mineures regroupées).
- **Sessions** : durée de vie ramenée à **7 jours** (`SESSION_TTL_DAYS`) et ajout
  d'un **timeout d'inactivité de 24 h** (`SESSION_IDLE_HOURS`, via
  `Session.lastUsedAt` rafraîchi au plus toutes les 5 min) ; les sessions
  expirées ou inactives sont supprimées.

### Modifié

- **Réglages** : les cartes réservées à l'administration (utilisateurs,
  invitations, demandes Spotify, restauration, inscriptions, état système) sont
  déplacées vers `/admin` ; la page Réglages ne conserve que les réglages
  personnels. `/status` redirige désormais vers `/admin`.
- **Réglages en sous-pages** : la page Réglages adopte la même structure que
  l'espace d'administration, avec des onglets et **une page par section** —
  *Compte*, *Spotify & sources*, *Import*, *Activité* et *Données*. Les
  redirections OAuth Spotify pointent vers l'onglet *Spotify & sources* et le
  bandeau de notification reste visible quel que soit l'onglet.

## [1.0.1] — 2026-10-12

### Ajouté

- **Restauration de sauvegarde** : import d'un dump `pg_dump` (`.dump`) depuis
  les **Réglages** (admin), via `POST /api/restore` (admin ou `SYNC_TOKEN`) ou la
  commande **`pnpm db:restore <fichier>`**. Un dump de sécurité de l'état courant
  est créé avant l'opération, et la restauration se fait dans une **transaction
  unique** (échec = aucun changement).

### Modifié

- **Docker** : nouveau fichier **`docker-compose.prod.yml`** pour un déploiement
  sans build (image GHCR épinglée, base non exposée, application liée à
  `localhost` pour un reverse proxy, rotation des logs).

## [1.0.0] — 2026-10-12

### Ajouté

- **Didacticiel de démarrage** : à la première visite du tableau de bord, une
  **modale d'accueil** en 4 étapes présente l'outil (connexion Spotify, import de
  l'historique, exploration) — affichée **une seule fois**. Une **checklist
  « Bien démarrer »** reste ensuite sur le tableau de bord tant que la source
  n'est pas connectée et l'historique importé (auto-complétion selon l'état réel,
  masquable). Bilingue, sans dépendance. Nouveaux champs `User.onboardedAt` et
  `User.checklistHiddenAt`.

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
  téléchargement de l'historique en CSV et de la **base complète** (dump
  PostgreSQL `.dump`) via `GET /api/export/db`. Le dump est produit par
  `pg_dump` et le téléchargement est réservé aux administrateurs (la base
  contient tous les comptes et les identifiants chiffrés).

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

- **Migration SQLite → PostgreSQL** : nouvelle commande **`pnpm migrate:sqlite`**
  qui copie une base SQLite existante vers PostgreSQL en conservant les
  identifiants (idempotente ; options `--sqlite <chemin>` et `--dry-run`).

### Modifié

- **Mobile** : menu de navigation **repliable** (bouton hamburger sous `md`),
  infobulle du graphique **en barres** au **toucher** (pointer events), et
  **cibles tactiles** agrandies (nav, onglets de période, en-tête).

- **Page Réglages** : disposition en **colonnes (masonry)** — 2 colonnes dès
  1024 px, 3 dès 1920 px — et carte « Activité récente » à hauteur bornée
  (défilement).

- **Base de données : passage de SQLite à PostgreSQL 18.** Le projet s'appuie
  désormais sur Prisma 7 avec le driver adapter `@prisma/adapter-pg` (au lieu de
  `better-sqlite3`). Le déploiement Docker ajoute un service **`db`**
  (`postgres:18-alpine`, volume `pgdata`) : `DATABASE_URL` devient une chaîne de
  connexion PostgreSQL et `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`
  sont configurables. Les **sauvegardes** (rotation + endpoint `/api/backup`) et
  l'**export** (`/api/export/db`) produisent des dumps `pg_dump`
  (`postgresql-client-18` est installé dans l'image). Les agrégations temporelles
  utilisent `EXTRACT(EPOCH ...)` au lieu de `strftime`.

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
- **Découvertes** : `getDiscoveredArtists` renvoie la vraie durée écoutée
  (`msPlayed` était figé à `0`).
- **Genres** : le JSON des genres stockés est parsé de façon **défensive**
  (une valeur corrompue ne casse plus le rendu).
- **Fuseaux** : le cache de décalage est indexé par **heure** (au lieu du jour
  UTC) et borné — corrige un décalage d'une heure les jours de changement
  d'heure et une fuite mémoire. Le décalage est aussi calculé **à la
  milliseconde** (les millisecondes étaient ignorées, ce qui pouvait faire
  basculer une écoute de minuit sur la veille).
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
- **Agrégations** : `getOverview` passe de **4 requêtes à 2** (un seul `groupBy`
  multi-clés) ; les séries jour/heure et le récapitulatif sont désormais agrégés
  **en SQL par tranches de 15 min** (`getTimeBuckets`) au lieu de charger toutes
  les écoutes en mémoire — résultat **identique** (vérifié sur 6 fuseaux, dont
  `+5:30`/`+5:45`) mais mémoire bornée. Les stats disque des Réglages sont faites
  en **asynchrone**. La synchronisation Spotify est **débitée dans le temps**
  (timeout + reprise sur erreur réseau), **verrouillée par connexion** (pas de
  double sync), et la reprise se base sur la **dernière écoute ingérée**
  (`lastPlayAt`) plutôt que sur l'heure de synchro.
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

- **Anti-SSRF renforcé** : les visuels distants sont récupérés par une requête
  **épinglée sur l'IP déjà validée** (plus de re-résolution DNS entre la
  validation et la connexion → fin du rebinding), avec SNI/`Host` d'origine. La
  détection des adresses privées couvre désormais NAT64, multicast, `100::/64`,
  `2001:db8::/32` et la forme canonique des IPv4-mappées.
- **Anti force-brute de l'auth Basic** des imports (`/api/import/*`) : même
  limiteur que la connexion. Et `X-Forwarded-For` est lu côté **proxy** (dernier
  saut) ; `TRUST_PROXY_HEADERS=false` pour l'ignorer si l'app est exposée
  directement.
- **Énumération d'emails** au login neutralisée (hash scrypt factice exécuté
  même si le compte n'existe pas → temps de réponse constant).
- **Sessions** : la ligne en base est désormais liée au `uid` du JWT.
- **Courses** : première inscription (« premier compte = admin ») et retrait du
  dernier admin passent en transaction **SERIALIZABLE**.
- **Divers** : `?range=` borné, `?email=` normalisé, messages d'erreur d'import
  génériques (loggés côté serveur), `/api/export/db` gère l'échec de `pg_dump`,
  `/api/wrapped/image` renvoie **401** au lieu d'une redirection, et
  `X-Powered-By` est désactivé.

- **Comparaison du `SYNC_TOKEN` en temps constant** partout où il est vérifié
  (`/api/sync`, `/api/backup`, `/api/export/db`, imports) via un helper commun
  (`src/lib/auth/sync-token.ts`) : lève l'incohérence qui subsistait avec
  `/api/sync`.
- **Contrôle du rôle administrateur centralisé** (`getAdminUser` /
  `getOptionalAdmin`) : toutes les actions réservées à l'administration passent
  par une seule vérification, ce qui évite tout oubli futur.
- **Accès Spotify administré** : les actions `approve`/`reject`/`revoke`
  n'agissent plus sur le compte de l'administrateur lui-même et **tolèrent un
  identifiant inexistant** (`updateMany` au lieu de `update`), là où une erreur
  `500` était possible.

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
- **SSRF** : la récupération des visuels distants **revalide chaque
  redirection** (`fetch` en `redirect: "manual"`), fermant le contournement par
  redirection vers un hôte interne (`169.254.169.254`, etc.).
- **Imports** : le corps est lu **en streaming** avec un plafond réel (le
  `Content-Length` seul était contournable en transfert `chunked`) ; imports et
  exports sont **limités en débit**.
- **Informations système** : les détails de l'instance (Node, `NODE_ENV`,
  uptime, taille de la base, sauvegardes) ne sont plus affichés qu'aux
  **administrateurs**.
- **POST `/api/sync`** : comparaison du `SYNC_TOKEN` en **temps constant**.
- **Sauvegardes** : nom de fichier rendu unique (évite les collisions de deux
  sauvegardes dans la même seconde) et fichier créé en **`0600`**.

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
