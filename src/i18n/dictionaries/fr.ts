import type { Dictionary } from "./en";

/** Traductions françaises. Les clés doivent correspondre à `en.ts`. */
export const fr: Dictionary = {
  // Navigation & shell
  "nav.overview": "Vue d'ensemble",
  "nav.compare": "Comparateur",
  "nav.recap": "Récapitulatif",
  "nav.history": "Historique",
  "nav.settings": "Réglages",
  "nav.menu": "Menu",
  "nav.logout": "Déconnexion",
  "nav.pendingRequests": "{count} demande(s) Spotify en attente",

  // Palette de commandes
  "palette.placeholder": "Rechercher ou aller à…",
  "palette.trigger": "Rechercher…",
  "palette.searchFor": "Rechercher « {query} » dans la bibliothèque",
  "palette.noResults": "Aucune page correspondante.",
  "palette.navigate": "↑↓ naviguer",
  "palette.open": "↵ ouvrir",
  "palette.close": "échap fermer",
  "shell.searchPlaceholder": "Rechercher…",
  "shell.spotifyAttribution":
    "Données et visuels musicaux fournis par Spotify.",
  "common.loading": "Chargement…",

  // Erreurs & page introuvable
  "error.title": "Une erreur est survenue",
  "error.body":
    "Une erreur inattendue est survenue pendant l'affichage de cette page. Vous pouvez réessayer.",
  "error.digest": "Référence : {digest}",
  "error.retry": "Réessayer",
  "error.home": "Retour au tableau de bord",
  "notFound.title": "Page introuvable",
  "notFound.body": "Cette page n'existe pas, ou vous n'y avez plus accès.",
  "notFound.home": "Retour au tableau de bord",

  // Thème
  "theme.label": "Thème",
  "theme.system": "Système",
  "theme.light": "Clair",
  "theme.dark": "Sombre",

  // Langue
  "locale.label": "Langue",

  // Authentication
  "auth.tagline": "Vos statistiques d'écoute, chez vous.",
  "auth.accountDeleted": "Votre compte a été définitivement supprimé.",
  "auth.email": "Adresse e-mail",
  "auth.emailPlaceholder": "vous@exemple.com",
  "auth.password": "Mot de passe",
  "auth.signIn": "Se connecter",
  "auth.signingIn": "Connexion…",
  "auth.noAccount": "Pas encore de compte ?",
  "auth.createAccount": "Créer un compte",
  "auth.signUpTitle": "Créer un compte",
  "auth.firstUser": "Première installation : ce compte sera administrateur.",
  "auth.join": "Rejoignez votre instance Statisfy.",
  "auth.name": "Nom",
  "auth.namePlaceholder": "Votre nom",
  "auth.passwordHint": "8 caractères, 1 chiffre",
  "auth.createAccountCta": "Créer le compte",
  "auth.creating": "Création…",
  "auth.alreadyAccount": "Déjà inscrit ?",
  "auth.invited": "Vous avez été invité à rejoindre cette instance.",

  // Validation & auth errors
  "validation.nameMin": "Au moins 2 caractères.",
  "validation.email": "Adresse e-mail invalide.",
  "validation.passwordMin": "Au moins 8 caractères.",
  "validation.passwordLetter": "Doit contenir une lettre.",
  "validation.passwordDigit": "Doit contenir un chiffre.",
  "autherr.disabled": "Les inscriptions sont désactivées.",
  "autherr.taken": "Un compte existe déjà avec cette adresse.",
  "autherr.credentials": "Identifiants incorrects.",
  "autherr.required": "Adresse e-mail et mot de passe requis.",
  "autherr.rateLimited": "Trop de tentatives. Réessayez dans {minutes} min.",
  "autherr.inviteInvalid": "Ce lien d'invitation est invalide ou a expiré.",
  "autherr.inviteEmail":
    "Cette invitation est réservée à une autre adresse e-mail.",

  // Range & source filters
  "range.today": "Auj.",
  "range.week": "Sem.",
  "range.month": "Mois",
  "range.year": "Année",
  "range.all": "Tout",
  "source.spotify": "Spotify",
  "source.import": "Import",

  // Dashboard
  "dash.title": "Vue d'ensemble",
  "dash.lastPlay": "Dernière écoute : {date}",
  "dash.noPlays": "Aucune écoute enregistrée",
  "dash.listeningTime": "Temps d'écoute",
  "dash.playsCount": "{count} écoutes",
  "dash.artists": "Artistes",
  "dash.tracks": "Titres",
  "dash.albums": "Albums",
  "dash.overTime": "Écoute dans le temps",
  "dash.dailyTime": "Temps d'écoute quotidien",
  "dash.hourlyTime": "Temps d'écoute par heure",
  "dash.topTracks": "Top titres",
  "dash.metricPlays": "Écoutes",
  "dash.metricTime": "Temps",
  "dash.topArtists": "Top artistes",
  "dash.genres": "Genres",
  "dash.genresWeighted": "Pondéré par écoutes",
  "dash.noTracks": "Pas encore de titres.",
  "dash.noArtists": "Pas encore d'artistes.",
  "dash.genresUnavailable":
    "Genres indisponibles. Synchronisez Spotify pour les enrichir.",
  "dash.avgPerDay": "moy./jour",
  "dash.empty":
    "Aucune donnée pour l'instant. Rendez-vous dans Réglages pour connecter une source ou importer votre historique Spotify.",
  "dash.rediscover": "Redécouvertes",
  "dash.rediscoverSubtitle": "Écoutés autrefois, à réécouter",
  "dash.rediscoverPlays": "{count} écoutes",
  "dash.rediscoverEmpty": "Rien à redécouvrir pour l'instant.",

  // Rankings
  "top.topTracks": "Titres les plus écoutés",
  "top.topArtists": "Artistes les plus écoutés",

  // Compare
  "compare.title": "Comparer des périodes",
  "compare.periodA": "Période A",
  "compare.periodB": "Période B",
  "compare.compare": "Comparer",
  "compare.swap": "Inverser",
  "compare.summary": "Synthèse",
  "compare.metric": "Indicateur",
  "compare.delta": "Évolution",
  "compare.overlay": "Comparaison du temps d'écoute",
  "compare.sideBySide": "Côte à côte",
  "compare.sameShape":
    "Choisissez deux périodes de même type (deux mois ou deux années) pour les superposer.",
  "compare.noData": "Aucune écoute sur cette période.",

  // History
  "history.title": "Historique",
  "history.daily": "Écoute quotidienne",
  "history.hourly": "Répartition horaire",
  "history.hourlySubtitle":
    "Moyenne par jour actif, sur la période sélectionnée",
  "history.recent": "{count} dernières écoutes",
  "history.loadMore": "Afficher 50 de plus",
  "history.noPlays": "Aucune écoute enregistrée.",
  "history.weekdayHour": "Jour et heure",
  "history.weekdayHourSubtitle":
    "Écoutes par jour de la semaine et heure locale",
  "history.behavior": "Habitudes d'écoute",
  "history.behaviorSubtitle": "D'après vos imports d'historique étendu",
  "history.skipRate": "Écoutes zappées",
  "history.shuffleRate": "Mode aléatoire",
  "history.offlineRate": "Hors ligne",
  "history.topPlatforms": "Appareils",
  "history.behaviorSample": "{count} écoutes analysées",

  // Records & séries
  "records.title": "Records & séries",
  "records.subtitle": "Sur l'ensemble de votre historique",
  "records.currentStreak": "Série en cours",
  "records.longestStreak": "Meilleure série",
  "records.activeDays": "Jours actifs",
  "records.busiestDay": "Jour le plus actif",
  "records.days": "jours",
  "records.allTime": "Depuis le début",

  // Recap (Wrapped)
  "recap.title": "Récapitulatif",
  "recap.periodMonth": "mois",
  "recap.periodYear": "année",
  "recap.yearLabel": "Année {year}",
  "recap.view": "Voir",
  "recap.wholeYear": "Toute l'année",
  "recap.download": "Télécharger l'image",
  "recap.downloadStory": "Image story (9:16)",
  "recap.heroKicker": "Votre {period} en musique",
  "recap.listening": "d'écoute",
  "recap.plays": "écoutes",
  "recap.artists": "artistes",
  "recap.tracks": "titres",
  "recap.delta": "{value}% vs période précédente",
  "recap.monthlyProgress": "Progression mensuelle",
  "recap.daily": "Écoute quotidienne",
  "recap.busiestDay": "Jour le plus actif",
  "recap.favoriteHour": "Heure préférée",
  "recap.activeDays": "Jours actifs",
  "recap.discovered": "Artistes découverts",
  "recap.yourArtists": "Vos artistes",
  "recap.top5Period": "Top 5 de la période",
  "recap.yourGenres": "Vos genres",
  "recap.genresWeighted": "Pondéré par écoutes",
  "recap.yourTracks": "Vos titres",
  "recap.top10": "Top 10",
  "recap.yourAlbums": "Vos albums",
  "recap.top5": "Top 5",
  "recap.noData":
    "Aucune écoute sur cette période. Choisissez une autre année ou importez votre historique depuis Réglages.",

  // Status
  "status.title": "Statut",
  "status.today": "Aujourd'hui",
  "status.week": "Cette semaine",
  "status.total": "Total",
  "status.lastSync": "Dernière synchro",
  "status.never": "jamais",
  "status.system": "Système",
  "status.app": "Application",
  "status.version": "Version",
  "status.env": "Environnement",
  "status.node": "Node.js",
  "status.uptime": "Démarré depuis",
  "status.dbSize": "Taille de la base",
  "status.autoSync": "Sync auto",
  "status.autoSyncOn": "activée (toutes les {minutes} min)",
  "status.autoSyncOff": "désactivée (pas de SYNC_TOKEN)",
  "status.import": "Import",
  "status.sync": "Sync",
  "status.importedHistory": "Historique importé",

  // Settings
  "settings.title": "Réglages",
  "settings.nav.account": "Compte",
  "settings.nav.sources": "Spotify & sources",
  "settings.nav.import": "Import",
  "settings.nav.activity": "Activité",
  "settings.nav.data": "Données",
  "settings.account": "Compte",
  "settings.timezone": "Fuseau horaire (utilisé pour les statistiques)",
  "settings.save": "Enregistrer",
  "settings.connectSpotify": "Connecter Spotify",
  "settings.connectSpotifySubtitle":
    "Synchronisation des écoutes récentes, des genres et des pochettes",
  "settings.connectSpotifyCta": "Connecter mon compte Spotify",
  "settings.spotifyNotConfigured":
    "Renseignez SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET (application créée sur le tableau de bord Spotify) puis redémarrez le serveur.",
  "settings.redirectUri": "URL de redirection à autoriser :",
  "settings.import": "Importer un historique Spotify",
  "settings.importSubtitle": "Depuis vos données de confidentialité Spotify",
  "settings.importRequest":
    "Demander vos données sur Spotify (historique d'écoute étendu)",
  "settings.importHint":
    "Export de données Spotify (.zip) ou les fichiers Streaming_History_Audio_*.json / StreamingHistory*.json. Plusieurs fichiers acceptés.",
  "settings.importCta": "Importer",
  "settings.importing": "Import en cours…",
  "settings.importAnalyzing": "Analyse du fichier…",
  "settings.importProgress": "{done} / {total} écoutes ({percent} %)",
  "settings.visuals": "Visuels",
  "settings.visualsSubtitle": "Pochettes d'albums et photos d'artistes",
  "settings.enrich": "Enrichir les visuels",
  "settings.enriching": "Enrichissement…",
  "settings.enrichHint":
    "Complète les pochettes d'albums et les photos d'artistes manquantes (notamment après un import) via le catalogue Spotify.",
  "settings.sources": "Sources connectées",
  "settings.noSources": "Aucune source pour le moment.",
  "settings.lastSync": "Dernière synchro : {date}",
  "settings.sync": "Synchroniser",
  "settings.syncing": "Synchronisation…",
  "settings.delete": "Supprimer",
  "settings.activity": "Activité récente",
  "settings.noActivity": "Aucune synchronisation ou import.",
  "settings.admin": "Administration",
  "settings.instance": "Instance {name}",
  "settings.registration": "Création de comptes : {state}",
  "settings.allowed": "autorisée",
  "settings.disabled": "désactivée",
  "settings.disableReg": "Désactiver les inscriptions",
  "settings.enableReg": "Autoriser les inscriptions",
  "settings.export": "Export",
  "settings.exportHint": "Télécharger vos données",
  "settings.dataTab.export": "Export",
  "settings.dataTab.sharing": "Partage",
  "settings.dataTab.api": "API",
  "settings.dataTab.danger": "Zone de danger",
  "settings.qrCode": "QR code",
  "settings.danger": "Zone de danger",
  "settings.deleteAccountHint":
    "Supprime définitivement votre compte, votre historique d'écoute, vos sources et vos liens de partage. Action irréversible.",
  "settings.deleteAccountConfirm":
    "Je comprends que mon compte et toutes mes données seront définitivement supprimés.",
  "settings.deleteAccountPassword": "Confirmez avec votre mot de passe",
  "settings.deleteAccountCta": "Supprimer définitivement mon compte",
  "settings.deleting": "Suppression…",
  "settings.exportCsv": "Historique (CSV)",
  "settings.exportDb": "Base de données (.dump)",

  // Settings / gestion des utilisateurs (admin)
  "settings.users": "Utilisateurs",
  "settings.usersSubtitle": "Comptes de cette instance",
  "settings.userAdmin": "Admin",
  "settings.you": "Vous",
  "settings.userStats": "{plays} écoutes · {sources} source(s)",
  "settings.makeAdmin": "Nommer admin",
  "settings.removeAdmin": "Retirer admin",
  "settings.deleteUser": "Supprimer",
  "settings.resetPassword": "Réinitialiser le mot de passe",
  "settings.resetting": "Réinitialisation…",
  "settings.changePassword": "Changer le mot de passe",
  "settings.currentPassword": "Mot de passe actuel",
  "settings.newPassword": "Nouveau mot de passe",
  "settings.passwordChanged": "Mot de passe mis à jour.",
  "settings.passwordWrong": "Mot de passe actuel incorrect.",
  "settings.invitations": "Invitations",
  "settings.invitationsSubtitle": "Inviter des personnes à créer un compte",
  "settings.inviteEmail": "Adresse e-mail (facultatif)",
  "settings.inviteEmailPlaceholder": "Restreindre à cette adresse",
  "settings.inviteDays": "Valable",
  "settings.inviteDaysValue": "{days} jour(s)",
  "settings.inviteCreate": "Créer une invitation",
  "settings.inviteCreating": "Création…",
  "settings.inviteCreated": "Lien d'invitation :",
  "settings.inviteNone": "Aucune invitation.",
  "settings.dismiss": "Masquer",
  "settings.anyEmail": "Toute adresse",
  "settings.invitePending": "En attente",
  "settings.inviteUsed": "Utilisée",
  "settings.inviteExpired": "Expirée",
  "settings.inviteExpires": "Expire le {date}",
  "settings.revoke": "Révoquer",
  "settings.copy": "Copier",
  "settings.copied": "Copié !",
  "settings.copyFailed": "Impossible de copier.",

  // Demandes d'accès Spotify
  "settings.spotifyAccount": "Compte Spotify (e-mail ou identifiant)",
  "settings.spotifyAccountPlaceholder": "vous@spotify.com",
  "settings.spotifyAccessNeeded":
    "L'accès à Spotify doit être validé par un administrateur avant de pouvoir connecter votre compte. Indiquez votre compte Spotify pour qu'il soit autorisé.",
  "settings.spotifyRequestCta": "Demander l'accès Spotify",
  "settings.spotifyRequesting": "Envoi…",
  "settings.spotifyPending":
    "Demande envoyée le {date}. En attente de validation par un administrateur.",
  "settings.spotifyRejected":
    "Votre demande précédente a été refusée. Vous pouvez en envoyer une nouvelle.",
  "settings.spotifyAccountLabel": "Compte demandé : {account}",
  "settings.spotifyRequests": "Demandes d'accès Spotify",
  "settings.spotifyRequestsSubtitle":
    "Approuvez les comptes que vous avez ajoutés à votre application Spotify",
  "settings.spotifyNoRequests": "Aucune demande en attente.",
  "settings.spotifyApprove": "Approuver",
  "settings.spotifyReject": "Refuser",
  "settings.spotifyRevoke": "Révoquer l'accès",
  "settings.spotifyCancel": "Annuler la demande",
  "settings.spotifyApproved": "Approuvé",
  "settings.spotifyPendingBadge": "En attente",
  "settings.spotifyRejectedBadge": "Refusé",
  "settings.confirmDeleteUser":
    "Supprimer « {name} » ? Toutes ses données seront effacées.",
  "settings.confirmRevoke":
    "Révoquer l'accès Spotify de « {name} » ? Sa connexion sera supprimée.",
  "settings.spotifyRequestedAt": "Demandé le {date}",

  // Partage du récapitulatif
  "settings.share": "Partager le récapitulatif",
  "settings.shareSubtitle": "Lien public en lecture seule vers votre récap",
  "settings.shareHint":
    "Toute personne disposant du lien peut consulter votre récapitulatif. Vous pouvez le désactiver à tout moment.",
  "settings.shareEnable": "Activer le partage",
  "settings.shareDisable": "Désactiver le partage",
  "settings.shareRegenerate": "Régénérer le lien",
  "settings.shareLink": "Lien public :",
  "settings.confirmUnshare":
    "Désactiver le lien public ? Les liens existants cesseront de fonctionner.",

  // Profil public
  "settings.profileShare": "Profil public",
  "settings.profileShareSubtitle":
    "Lien public en lecture seule vers vos statistiques",
  "settings.profileShareHint":
    "Choisissez les sections visibles. Toute personne disposant du lien peut les consulter.",
  "settings.profileShareHintOff":
    "Partagez un lien public vers vos statistiques (période au choix). Vous pouvez le désactiver ou régénérer le jeton à tout moment.",
  "settings.profileShareTopArtists": "Top artistes",
  "settings.profileShareTopTracks": "Top titres",
  "settings.profileShareRecent": "Dernières écoutes",
  "settings.profileShareHeatmap": "Activité annuelle",
  "settings.profileShareSave": "Enregistrer les sections",
  "settings.confirmProfileUnshare":
    "Désactiver le profil public ? Les liens existants cesseront de fonctionner.",
  "profile.kicker": "Profil partagé",
  "profile.subtitle": "Statistiques d'écoute partagées en lecture seule.",
  "profile.recent": "Dernières écoutes",

  // API de statistiques
  "settings.api": "API & intégrations",
  "settings.apiSubtitle":
    "Statistiques en lecture seule pour vos tableaux de bord",
  "settings.apiHint":
    "Activez un jeton pour interroger vos statistiques depuis Homepage, Grafana ou un script. Le jeton donne accès aux agrégats, jamais à votre historique brut.",
  "settings.apiHintActive":
    "Le jeton est actif. Quiconque le possède peut lire vos statistiques : régénérez-le s'il a fuité.",
  "settings.apiEnable": "Activer l'API",
  "settings.apiDisable": "Désactiver l'API",
  "settings.apiRegenerate": "Régénérer le jeton",
  "settings.apiEndpoint": "Point d'accès :",
  "settings.apiCard": "Carte SVG (Markdown) :",
  "settings.apiDocs": "Documentation Swagger (OpenAPI)",
  "settings.confirmApiDisable":
    "Désactiver l'API ? Les widgets et scripts utilisant ce jeton cesseront de fonctionner.",

  // Documentation API
  "apiDocs.kicker": "Intégrations",
  "apiDocs.title": "Documentation de l'API",
  "apiDocs.subtitle":
    "Référence interactive de l'API de {name}. Les routes protégées nécessitent un jeton (Réglages → Données personnelles).",
  "apiDocs.openSpec": "Spécification OpenAPI (JSON)",
  "apiDocs.back": "Retour à Statisfy",
  "apiDocs.loading": "Chargement de Swagger UI…",
  "apiDocs.loadError":
    "Impossible de charger Swagger UI. La spécification reste disponible sur",

  "share.kicker": "Récapitulatif partagé",
  "share.ogDescription":
    "{name} — {period} : {plays} écoutes et {time} d'écoute.",
  "share.footer": "Réalisé avec {name}",

  // Settings / connection action messages
  "msg.syncDone": "Synchronisation terminée : {count} nouvelle(s) écoute(s).",
  "msg.importDone":
    "Import terminé : {inserted} écoute(s) importée(s) sur {total} lue(s) ({files} fichier(s)).",
  "msg.importDoneVisuals": " {count} visuel(s) ajouté(s).",
  "msg.enrichDone":
    "Visuels enrichis : {albums}/{albumsChecked} album(s) et {artists}/{artistsChecked} artiste(s).",
  "err.selectFile": "Sélectionnez au moins un fichier JSON.",
  "err.noHistory":
    "Aucun historique exploitable dans les fichiers sélectionnés.",
  "err.importFailed": "Échec de l'import.",
  "err.syncFailed": "Échec de la synchronisation.",
  "err.connectionNotFound": "Connexion introuvable.",
  "err.invitationNotFound": "Invitation introuvable.",
  "err.lastAdmin": "Au moins un administrateur doit rester.",
  "err.actionFailed": "Échec de l'action. Veuillez réessayer.",
  "err.forbidden": "Action non autorisée.",
  "err.userNotFound": "Utilisateur introuvable.",
  "err.passwordRequired": "Saisissez votre mot de passe.",
  "err.wrongPassword": "Mot de passe incorrect.",
  "err.deleteConfirm": "Cochez la case de confirmation pour continuer.",
  "err.tooManyAttempts": "Trop de tentatives. Réessayez plus tard.",
  "err.spotifyAccountRequired": "Indiquez votre compte Spotify.",
  "msg.spotifyRequested": "Demande envoyée. Un administrateur va la valider.",
  "msg.passwordReset":
    "Mot de passe temporaire : {password} — transmettez-le de façon sûre, puis invitez l'utilisateur à le changer.",
  "err.enrichFailed": "Échec de l'enrichissement des visuels.",
  "settings.yourspotify": "Importer depuis Your Spotify",
  "settings.yourspotifySubtitle": "Dump MongoDB (BSON ou JSON)",
  "settings.yourspotifyHint":
    "Sélectionnez les fichiers du dump (infos, tracks, albums, artists) en .bson ou .json — ou un .zip.",
  "msg.yourspotifyDone":
    "Import Your Spotify : {inserted} écoute(s) sur {total}.",
  "ys.err.noInfos":
    "Aucune écoute trouvée. Incluez la collection infos (BSON ou JSON).",

  // OAuth notices
  "notice.spotify": "Compte Spotify connecté avec succès.",
  "notice.spotify_config":
    "Spotify n'est pas configuré sur le serveur (SPOTIFY_CLIENT_ID / SECRET).",
  "notice.spotify_denied": "Connexion Spotify annulée.",
  "notice.spotify_state": "Session OAuth invalide ou expirée, réessayez.",
  "notice.spotify_exchange": "Échec de l'échange de jeton auprès de Spotify.",
  "notice.spotify_not_approved":
    "Votre accès à Spotify n'a pas encore été validé.",

  // Search
  "search.title": "Recherche",
  "search.placeholder": "Rechercher un artiste ou un titre…",
  "search.submit": "Chercher",
  "search.hint": "Saisissez un mot-clé pour explorer votre bibliothèque.",
  "search.noResults": "Aucun résultat pour « {query} ».",
  "search.artists": "Artistes",
  "search.tracks": "Titres",
  "search.resultsCount": "{count} résultat(s)",
  "search.noArtist": "Aucun artiste.",
  "search.noTrack": "Aucun titre.",

  // Artist detail
  "artist.kicker": "Artiste",
  "artist.distinctTracks": "Titres distincts",
  "artist.distinctAlbums": "Albums distincts",
  "artist.firstPlay": "Première écoute",
  "artist.lastPlayHint": "Dernière : {date}",
  "artist.noPlays": "Aucune écoute de cet artiste sur la période sélectionnée.",
  "artist.albums": "Albums",
  "artist.recent": "Écoutes récentes",
  "artist.noRecent": "Aucune écoute.",

  // Track detail
  "track.kicker": "Titre",
  "track.plays": "Écoutes",
  "track.lastPlay": "Dernière écoute",
  "track.noPlays": "Aucune écoute de ce titre sur la période sélectionnée.",

  // Charts
  "chart.evolution": "Évolution de l'écoute",
  "chart.noData": "Aucune donnée.",

  // Generic
  "generic.noData": "Aucune donnée.",

  // Heatmap & sauvegardes
  "history.heatmap": "Activité annuelle",
  "history.heatmapSubtitle": "Écoutes par jour sur 12 mois",
  "status.backups": "Sauvegardes",
  "status.backupsValue": "{count} fichier(s)",
  "bytes.b": "o",
  "bytes.kb": "Ko",
  "bytes.mb": "Mo",
  "uptime.days": "{d} j {h} h",
  "uptime.hours": "{h} h {m} min",
  "uptime.minutes": "{m} min",

  // Didacticiel (accueil + checklist de démarrage)
  "onboard.subtitle": "Visite rapide · {total} étapes",
  "onboard.next": "Suivant",
  "onboard.prev": "Précédent",
  "onboard.finish": "C'est parti",
  "onboard.skip": "Passer",
  "onboard.step1.title": "Bienvenue 👋",
  "onboard.step1.body":
    "Statisfy transforme vos écoutes Spotify en statistiques claires et privées. Tout reste sur votre propre instance.",
  "onboard.step2.title": "Connecter Spotify",
  "onboard.step2.body":
    "Dans les Réglages, connectez votre compte Spotify pour synchroniser automatiquement vos écoutes récentes et vos genres.",
  "onboard.step3.title": "Importer votre historique",
  "onboard.step3.body":
    "Pour l'historique complet, importez votre export de données Spotify (Confidentialité). L'import est idempotent : le relancer ne crée pas de doublon.",
  "onboard.step4.title": "Explorer",
  "onboard.step4.body":
    "Parcourez le Comparateur, votre Récapitulatif et l'Historique. Bonne exploration !",
  "checklist.title": "Bien démarrer",
  "checklist.subtitle": "Quelques étapes pour profiter de Statisfy",
  "checklist.connect": "Connecter Spotify",
  "checklist.import": "Importer votre historique",
  "checklist.hide": "Masquer",

  // Espace d'administration
  "nav.admin": "Admin",
  "admin.title": "Administration",
  "admin.subtitle": "Instance {name}",
  "admin.nav.overview": "Vue d'ensemble",
  "admin.nav.users": "Utilisateurs",
  "admin.nav.invitations": "Invitations",
  "admin.nav.spotify": "Accès Spotify",
  "admin.nav.instance": "Instance",
  "admin.overviewTitle": "Vue d'ensemble",
  "admin.overviewSubtitle": "L'instance en un coup d'œil",
  "admin.statUsers": "Comptes",
  "admin.statAdminsHint": "{count} admin(s)",
  "admin.statAdmins": "Administrateurs",
  "admin.statPending": "Demandes en attente",
  "admin.statInvitations": "Invitations actives",
  "admin.systemSubtitle": "Informations d'exécution",
  "admin.registrationTitle": "Inscriptions",
  "admin.registrationSubtitle": "Qui peut créer un compte",
  "admin.thresholdTitle": "Seuil de comptabilisation",
  "admin.thresholdSubtitle":
    "Une écoute ne compte que si au moins cette part de la piste a été écoutée. 0 % : tout compte.",
  "admin.thresholdLabel": "Écoute minimale",
  "admin.thresholdSave": "Enregistrer et recalculer",

  // Webhooks sortants
  "admin.webhookTitle": "Webhooks sortants",
  "admin.webhookSubtitle":
    "Être notifié à la fin d'une synchronisation ou d'un import",
  "admin.webhookUrl": "URL du webhook",
  "admin.webhookUrlPlaceholder":
    "https://discord.com/api/webhooks/… ou https://ntfy.sh/mon-sujet",
  "admin.webhookSecret": "Secret de signature (facultatif)",
  "admin.webhookHint":
    "Discord, ntfy, Home Assistant et n8n sont détectés automatiquement. Sinon, un JSON générique est envoyé. Le secret facultatif signe le corps brut en HMAC-SHA256 (X-Statisfy-Signature). Laissez l'URL vide pour désactiver.",
  "admin.webhookSave": "Enregistrer le webhook",
  "admin.webhookSaving": "Enregistrement…",
  "admin.webhookSaved": "Webhook enregistré.",
  "admin.webhookCleared": "Webhook désactivé.",
  "admin.webhookTest": "Envoyer un test",
  "admin.webhookTesting": "Envoi…",
  "admin.webhookTestSent": "Test envoyé.",
  "admin.webhookTestFailed":
    "Échec du test. Vérifiez l'URL et le journal d'événements.",
  "admin.webhookNoUrl": "Enregistrez d'abord une URL de webhook.",
  "admin.webhookInvalidUrl": "URL invalide (http ou https requis).",
  "admin.webhookSecretTooLong":
    "Le secret est trop long (200 caractères maximum).",
  "admin.webhookTestTitle": "Test Statisfy",
  "admin.webhookTestMessage":
    "Ceci est un webhook de test envoyé par votre instance Statisfy.",

  // Real User Monitoring
  "admin.rumTitle": "Real User Monitoring",
  "admin.rumSubtitle": "SDK navigateur OpenObserve",
  "admin.rumEnabled":
    "Activé → {site} (org « {org} », échantillonnage {rate} %).",
  "admin.rumDisabled":
    "Non configuré. Remplissez le formulaire ci-dessous pour activer le RUM.",
  "admin.rumEnable": "Activer le RUM",
  "admin.rumUrl": "URL OpenObserve",
  "admin.rumUrlPlaceholder": "http://192.168.1.10:5080",
  "admin.rumOrg": "Organisation",
  "admin.rumToken": "Jeton client RUM",
  "admin.rumTokenHint":
    "Depuis Ingestion → RUM dans OpenObserve. Stocké côté serveur : les événements sont relayés par Statisfy et le jeton n'est jamais envoyé aux visiteurs.",
  "admin.rumApplicationId": "ID d'application",
  "admin.rumService": "Nom du service",
  "admin.rumEnv": "Environnement",
  "admin.rumSampleRate": "Échantillonnage des sessions (%)",
  "admin.rumPrivacy": "Niveau de confidentialité",
  "admin.rumPrivacyMaskInput": "Masquer les saisies (recommandé)",
  "admin.rumPrivacyMask": "Tout masquer",
  "admin.rumPrivacyAllow": "Tout autoriser",
  "admin.rumPersistence": "Persistance de session",
  "admin.rumPersistenceMemory": "Mémoire (aucun cookie durable)",
  "admin.rumPersistenceCookie": "Cookie",
  "admin.rumPersistenceLocalStorage": "Stockage local",
  "admin.rumPersistenceHint":
    "Le mode mémoire démarre une nouvelle session à chaque chargement.",
  "admin.rumTrackResources": "Suivre les ressources",
  "admin.rumTrackLongTasks": "Suivre les tâches longues",
  "admin.rumTrackInteractions": "Suivre les interactions",
  "admin.rumSave": "Enregistrer le RUM",
  "admin.rumSaving": "Enregistrement…",
  "admin.rumSaved": "Configuration RUM enregistrée.",
  "admin.rumForcedOff":
    "Le RUM est forcé désactivé par OPENOBSERVE_RUM_ENABLED=false. Retirez cette variable pour l'activer.",
  "admin.rumUrlRequired": "Renseignez l'URL OpenObserve.",
  "admin.rumTokenRequired": "Renseignez le jeton client RUM.",
  "admin.rumInvalidUrl": "URL invalide (http ou https requis).",
  "admin.rumInvalidRate": "L'échantillonnage doit être compris entre 0 et 100.",
  "admin.rumReplaySampleRate": "Échantillonnage du replay (%)",
  "admin.rumLogs": "Collecter les logs et erreurs navigateur",
  "admin.rumForwardErrors": "Transmettre les erreurs aux logs",
  "admin.rumStartReplay": "Démarrer l'enregistrement de sessions",
  "admin.rumReplayWarning":
    "Le replay enregistre le contenu des pages. Il est automatiquement mis en pause sur Réglages et Administration.",
  "admin.rumInvalidReplayRate":
    "L'échantillonnage du replay doit être compris entre 0 et 100.",
  "admin.rumAdvanced": "Options avancées",
  "admin.rumTokenKeep":
    "Jeton enregistré ({hint}). Laissez vide pour le conserver, ou saisissez un nouveau jeton.",
  "admin.rumPrivacyAllowWarning":
    "« Tout autoriser » enregistre le contenu des pages et les saisies : à utiliser vraiment si nécessaire.",
  "admin.rumTest": "Tester la connexion",
  "admin.rumTesting": "Test en cours…",
  "admin.rumTestHint": "Envoie un petit événement de test.",
  "admin.rumTestSuccess":
    "Connexion OK — OpenObserve a accepté l'événement de test.",
  "admin.rumTestAuth":
    "Échec d'authentification (HTTP {status}). Vérifiez le jeton RUM.",
  "admin.rumTestNotFound":
    "Endpoint introuvable (HTTP 404). Vérifiez l'URL et l'organisation.",
  "admin.rumTestFailed": "OpenObserve a répondu HTTP {status}.",
  "admin.rumTestNetwork":
    "Impossible de joindre OpenObserve depuis le serveur. Vérifiez l'URL et l'accès réseau.",
  "admin.rumTestRejected": "OpenObserve a rejeté l'événement de test.",
  "admin.rumLastEvent": "Dernier événement reçu : {when} ({track}).",
  "admin.rumNoEvent": "Aucun événement reçu pour le moment.",
  "admin.rumLastError": "Dernière erreur : {when} (HTTP {status}).",
  "admin.rumLastErrorNetwork": "Dernière erreur : {when} (erreur réseau).",
  "admin.rumOpen": "Ouvrir OpenObserve",
  "settings.completionRate":
    "{percent} % des écoutes ont atteint le seuil d'écoute.",
  "admin.backupTitle": "Sauvegarde & restauration",
  "admin.backupSubtitle": "Exporter ou remplacer la base de données",
  "admin.exportDbHint": "Dump PostgreSQL complet de cette instance.",

  // Espace d'administration / journal
  "admin.nav.logs": "Journaux",
  "admin.logsTitle": "Journal d'événements",
  "admin.logsSubtitle": "Activité récente de l'instance",
  "admin.logFilterLevel": "Niveau",
  "admin.logFilterSource": "Origine",
  "admin.logFilterSearch": "Recherche",
  "admin.logFilterSearchPlaceholder": "Message…",
  "admin.logFilterAll": "Tous",
  "admin.logFilterFrom": "Du",
  "admin.logFilterTo": "Au",
  "admin.logDate": "Date",
  "admin.logMessage": "Message",
  "admin.logClear": "Vider le journal",
  "admin.logClearConfirm":
    "Supprimer toutes les entrées du journal ? Action irréversible.",
  "admin.logTest": "Tester l'envoi",
  "admin.logTestSending": "Envoi…",
  "admin.logTestSent": "Événement de test envoyé au sink ({sink}).",
  "admin.logTestDisabled":
    "Aucun sink de logs configuré (renseignez LOG_SINK).",
  "admin.logTestFailed": "Échec de l'envoi : {error}",
  "admin.logSinkActive": "Sink de logs actif : {sink}",
  "admin.logFilterApply": "Filtrer",
  "admin.logFilterReset": "Réinitialiser",
  "admin.logExportCsv": "Export CSV",
  "admin.logExportJson": "Export JSON",
  "admin.logEmpty": "Aucune entrée.",
  "admin.logUser": "Compte",
  "admin.logIp": "IP",
  "admin.logShowing": "{count} entrée(s) · page {page}/{pages}",
  "admin.logPrev": "Précédent",
  "admin.logNext": "Suivant",
  "admin.logSource.auth": "Authentification",
  "admin.logSource.admin": "Administration",
  "admin.logSource.sync": "Synchronisation",
  "admin.logSource.import": "Import",
  "admin.logSource.backup": "Sauvegarde",
  "admin.logSource.source": "Source",
  "admin.logSource.system": "Système",
  "admin.logLevel.debug": "Debug",
  "admin.logLevel.info": "Info",
  "admin.logLevel.warn": "Avertissement",
  "admin.logLevel.error": "Erreur",

  // Restauration de sauvegarde
  "settings.restore": "Restaurer une sauvegarde",
  "settings.restoreSubtitle":
    "Importer un fichier `.dump` — remplace les données actuelles",
  "settings.restoreHint":
    "Un fichier produit par « Base de données (.dump) » ou présent dans le dossier des sauvegardes.",
  "settings.restoreCta": "Restaurer",
  "settings.restoring": "Restauration…",
  "settings.confirmRestore":
    "Cela remplace toutes les données actuelles. Continuer ?",
  "msg.restoreDone": "Sauvegarde restaurée.",
  "err.restoreFailed":
    "Échec de la restauration (dump invalide ou incompatible ?).",
};
