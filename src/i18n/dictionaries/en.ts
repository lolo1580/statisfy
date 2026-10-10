/**
 * Source of truth for translations (English, default language).
 * Keys are flat with dot notation. Keep `fr.ts` in sync.
 */
export type Dictionary = Record<string, string>;

export const en: Dictionary = {
  // Navigation & shell
  "nav.overview": "Overview",
  "nav.rankings": "Rankings",
  "nav.recap": "Recap",
  "nav.history": "History",
  "nav.status": "Status",
  "nav.settings": "Settings",
  "nav.logout": "Sign out",
  "shell.searchPlaceholder": "Search…",

  // Authentication
  "auth.tagline": "Your listening stats, at home.",
  "auth.email": "Email address",
  "auth.emailPlaceholder": "you@example.com",
  "auth.password": "Password",
  "auth.signIn": "Sign in",
  "auth.signingIn": "Signing in…",
  "auth.noAccount": "No account yet?",
  "auth.createAccount": "Create an account",
  "auth.signUpTitle": "Create an account",
  "auth.firstUser":
    "First setup: this account will be an administrator.",
  "auth.join": "Join your Statisfy instance.",
  "auth.name": "Name",
  "auth.namePlaceholder": "Your name",
  "auth.passwordHint": "8 characters, 1 number",
  "auth.createAccountCta": "Create account",
  "auth.creating": "Creating…",
  "auth.alreadyAccount": "Already registered?",

  // Validation & auth errors
  "validation.nameMin": "At least 2 characters.",
  "validation.email": "Invalid email address.",
  "validation.passwordMin": "At least 8 characters.",
  "validation.passwordLetter": "Must contain a letter.",
  "validation.passwordDigit": "Must contain a number.",
  "autherr.disabled": "Registrations are disabled.",
  "autherr.taken": "An account already exists with this address.",
  "autherr.credentials": "Invalid credentials.",
  "autherr.required": "Email and password are required.",

  // Range & source filters
  "range.today": "Today",
  "range.week": "Week",
  "range.month": "Month",
  "range.7": "7d",
  "range.30": "30d",
  "range.90": "90d",
  "range.365": "1y",
  "range.all": "All",
  "source.all": "All",
  "source.spotify": "Spotify",
  "source.import": "Import",

  // Dashboard
  "dash.title": "Overview",
  "dash.lastPlay": "Last play: {date}",
  "dash.noPlays": "No plays recorded",
  "dash.listeningTime": "Listening time",
  "dash.playsCount": "{count} plays",
  "dash.artists": "Artists",
  "dash.tracks": "Tracks",
  "dash.albums": "Albums",
  "dash.overTime": "Listening over time",
  "dash.dailyTime": "Daily listening time",
  "dash.topTracks": "Top tracks",
  "dash.topArtists": "Top artists",
  "dash.genres": "Genres",
  "dash.genresWeighted": "Weighted by plays",
  "dash.noTracks": "No tracks yet.",
  "dash.noArtists": "No artists yet.",
  "dash.genresUnavailable":
    "Genres unavailable. Sync Spotify to enrich them.",
  "dash.whenListen": "When do you listen?",
  "dash.byHour": "Breakdown by local hour",
  "dash.empty":
    "No data yet. Head to Settings to connect a source or import your Spotify history.",
  "dash.sourceChip": "{label} · {plays} plays ({duration})",

  // Rankings
  "top.title": "Rankings",
  "top.topTracks": "Most played tracks",
  "top.topArtists": "Most played artists",
  "top.topAlbums": "Most played albums",

  // History
  "history.title": "History",
  "history.daily": "Daily listening",
  "history.hourly": "Hourly breakdown",
  "history.hourlySubtitle": "Local hour, over the selected period",
  "history.recent": "Last 50 plays",
  "history.noPlays": "No plays recorded.",

  // Recap (Wrapped)
  "recap.title": "Recap",
  "recap.periodMonth": "month",
  "recap.periodYear": "year",
  "recap.yearLabel": "{year}",
  "recap.view": "View",
  "recap.wholeYear": "Whole year",
  "recap.download": "Download image",
  "recap.heroKicker": "Your {period} in music",
  "recap.listening": "listening",
  "recap.plays": "plays",
  "recap.artists": "artists",
  "recap.tracks": "tracks",
  "recap.delta": "{value}% vs previous period",
  "recap.monthlyProgress": "Monthly progress",
  "recap.daily": "Daily listening",
  "recap.busiestDay": "Busiest day",
  "recap.favoriteHour": "Favourite hour",
  "recap.activeDays": "Active days",
  "recap.discovered": "Discovered artists",
  "recap.yourArtists": "Your artists",
  "recap.top5Period": "Top 5 of the period",
  "recap.yourGenres": "Your genres",
  "recap.genresWeighted": "Weighted by plays",
  "recap.yourTracks": "Your tracks",
  "recap.top10": "Top 10",
  "recap.yourAlbums": "Your albums",
  "recap.top5": "Top 5",
  "recap.noData":
    "No plays for this period. Pick another year or import your history from Settings.",

  // Status
  "status.title": "Status",
  "status.today": "Today",
  "status.week": "This week",
  "status.total": "Total",
  "status.lastSync": "Last sync",
  "status.connections": "Connections",
  "status.connectionsSubtitle": "Listening sources and sync state",
  "status.noSources": "No source connected.",
  "status.never": "never",
  "status.nextSync": "next sync ≈ {time} (every {minutes} min)",
  "status.system": "System",
  "status.app": "Application",
  "status.env": "Environment",
  "status.node": "Node.js",
  "status.uptime": "Uptime",
  "status.dbSize": "Database size",
  "status.autoSync": "Auto sync",
  "status.autoSyncOn": "enabled (every {minutes} min)",
  "status.autoSyncOff": "disabled (no SYNC_TOKEN)",
  "status.activity": "Recent activity",
  "status.noActivity": "No sync recorded.",
  "status.import": "Import",
  "status.sync": "Sync",
  "status.importedHistory": "Imported history",

  // Settings
  "settings.title": "Settings",
  "settings.account": "Account",
  "settings.timezone": "Timezone (used for statistics)",
  "settings.save": "Save",
  "settings.connectSpotify": "Connect Spotify",
  "settings.connectSpotifySubtitle":
    "Recent plays, genres and covers",
  "settings.connectSpotifyCta": "Connect my Spotify account",
  "settings.spotifyNotConfigured":
    "Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET (app created on the Spotify dashboard) then restart the server.",
  "settings.redirectUri": "Redirect URI to allow:",
  "settings.import": "Import Spotify history",
  "settings.importSubtitle": "From your Spotify privacy data",
  "settings.importHint":
    "Spotify data export (.zip) or the Streaming_History_Audio_*.json / StreamingHistory*.json files. Multiple files accepted.",
  "settings.importCta": "Import",
  "settings.importing": "Importing…",
  "settings.visuals": "Artwork",
  "settings.visualsSubtitle": "Album covers and artist photos",
  "settings.enrich": "Enrich artwork",
  "settings.enriching": "Enriching…",
  "settings.enrichHint":
    "Completes missing album covers and artist photos (especially after an import) using the Spotify catalog.",
  "settings.sources": "Connected sources",
  "settings.noSources": "No source yet.",
  "settings.lastSync": "Last sync: {date}",
  "settings.sync": "Sync",
  "settings.syncing": "Syncing…",
  "settings.delete": "Delete",
  "settings.activity": "Recent activity",
  "settings.noActivity": "No sync or import.",
  "settings.admin": "Administration",
  "settings.instance": "Instance {name}",
  "settings.registration": "Account creation: {state}",
  "settings.allowed": "allowed",
  "settings.disabled": "disabled",
  "settings.disableReg": "Disable registrations",
  "settings.enableReg": "Allow registrations",

  // Settings / connection action messages
  "msg.syncDone": "Sync done: {count} new play(s).",
  "msg.importDone":
    "Import done: {inserted} play(s) imported out of {total} read ({files} file(s)).",
  "msg.importDoneVisuals": " {count} artwork added.",
  "msg.enrichDone":
    "Artwork enriched: {albums}/{albumsChecked} album(s) and {artists}/{artistsChecked} artist(s).",
  "err.selectFile": "Select at least one JSON file.",
  "err.noJson": "No .json file recognised.",
  "err.noHistory": "No playable history found in the selected files.",
  "err.importFailed": "Import failed.",
  "err.syncFailed": "Sync failed.",
  "err.connectionNotFound": "Connection not found.",
  "err.enrichFailed": "Artwork enrichment failed.",
  "settings.yourspotify": "Import from Your Spotify",
  "settings.yourspotifySubtitle": "MongoDB dump (BSON or JSON)",
  "settings.yourspotifyHint":
    "Select the dump files (infos, tracks, albums, artists) in .bson or .json — or a .zip of them.",
  "msg.yourspotifyDone":
    "Your Spotify import: {inserted} play(s) imported out of {total}.",
  "ys.err.noInfos":
    "No plays found. Include the infos collection (BSON or JSON).",

  // OAuth notices
  "notice.spotify": "Spotify account connected successfully.",
  "notice.spotify_config":
    "Spotify is not configured on the server (SPOTIFY_CLIENT_ID / SECRET).",
  "notice.spotify_denied": "Spotify connection cancelled.",
  "notice.spotify_state": "Invalid or expired OAuth session, please retry.",
  "notice.spotify_exchange": "Failed to exchange token with Spotify.",

  // Search
  "search.title": "Search",
  "search.placeholder": "Search for an artist or a track…",
  "search.submit": "Search",
  "search.hint": "Type a keyword to explore your library.",
  "search.noResults": "No results for “{query}”.",
  "search.artists": "Artists",
  "search.tracks": "Tracks",
  "search.resultsCount": "{count} result(s)",
  "search.noArtist": "No artist.",
  "search.noTrack": "No track.",

  // Artist detail
  "artist.kicker": "Artist",
  "artist.distinctTracks": "Distinct tracks",
  "artist.distinctAlbums": "Distinct albums",
  "artist.firstPlay": "First play",
  "artist.lastPlayHint": "Last: {date}",
  "artist.noPlays": "No plays for this artist in the selected period.",
  "artist.albums": "Albums",
  "artist.recent": "Recent plays",
  "artist.noRecent": "No plays.",

  // Track detail
  "track.kicker": "Track",
  "track.plays": "Plays",
  "track.lastPlay": "Last play",
  "track.sources": "Sources",
  "track.duration": "Duration",
  "track.noPlays": "No plays for this track in the selected period.",

  // Charts
  "chart.evolution": "Listening evolution",
  "chart.noData": "No data.",

  // Generic
  "generic.noData": "No data.",

  // Insights, trends & backups
  "nav.insights": "Insights",
  "dash.trends": "Trends",
  "dash.trendsSubtitle": "vs previous {days} days",
  "dash.rising": "Rising",
  "dash.falling": "Falling",
  "history.heatmap": "Yearly activity",
  "history.heatmapSubtitle": "Daily plays over the last 12 months",
  "insights.title": "Insights",
  "insights.obsessions": "On repeat",
  "insights.obsessionsSubtitle": "Biggest rises over the last 30 days",
  "insights.rediscoveries": "Rediscover",
  "insights.rediscoveriesSubtitle":
    "Loved before, but not played in the last 90 days",
  "insights.noObsessions": "No rising artists right now.",
  "insights.noRediscoveries": "Nothing to rediscover.",
  "insights.lastPlayed": "Last played {date}",
  "status.backups": "Backups",
  "status.backupsValue": "{count} file(s)",
  "msg.backupDone": "Backup created: {file} ({kept} kept).",
  "err.backupFailed": "Backup failed.",

  "bytes.b": "B",
  "bytes.kb": "KB",
  "bytes.mb": "MB",
  "uptime.days": "{d}d {h}h",
  "uptime.hours": "{h}h {m}m",
  "uptime.minutes": "{m}m",
};
