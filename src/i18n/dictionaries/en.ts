/**
 * Source of truth for translations (English, default language).
 * Keys are flat with dot notation. Keep `fr.ts` in sync.
 */
export type Dictionary = Record<string, string>;

export const en: Dictionary = {
  // Navigation & shell
  "nav.overview": "Overview",
  "nav.rankings": "Rankings",
  "nav.compare": "Compare",
  "nav.trends": "Trends",
  "nav.recap": "Recap",
  "nav.history": "History",
  "nav.settings": "Settings",
  "nav.menu": "Menu",
  "nav.logout": "Sign out",
  "nav.pendingRequests": "{count} pending Spotify request(s)",
  "shell.searchPlaceholder": "Search…",
  "shell.spotifyAttribution": "Music data and artwork provided by Spotify.",

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
  "auth.invited": "You have been invited to join this instance.",

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
  "autherr.rateLimited": "Too many attempts. Try again in {minutes} min.",
  "autherr.inviteInvalid": "This invitation link is invalid or has expired.",
  "autherr.inviteEmail":
    "This invitation is reserved for another email address.",

  // Range & source filters
  "range.today": "Today",
  "range.week": "Week",
  "range.month": "Month",
  "range.year": "Year",
  "range.all": "All",
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
  "dash.hourlyTime": "Listening time by hour",
  "dash.topTracks": "Top tracks",
  "dash.metricPlays": "Plays",
  "dash.metricTime": "Time",
  "dash.topArtists": "Top artists",
  "dash.genres": "Genres",
  "dash.genresWeighted": "Weighted by plays",
  "dash.noTracks": "No tracks yet.",
  "dash.noArtists": "No artists yet.",
  "dash.genresUnavailable":
    "Genres unavailable. Sync Spotify to enrich them.",
  "dash.avgPerDay": "avg/day",
  "dash.empty":
    "No data yet. Head to Settings to connect a source or import your Spotify history.",

  // Rankings
  "top.title": "Rankings",
  "top.topTracks": "Most played tracks",
  "top.topArtists": "Most played artists",
  "top.topAlbums": "Most played albums",

  // Compare
  "compare.title": "Compare periods",
  "compare.periodA": "Period A",
  "compare.periodB": "Period B",
  "compare.compare": "Compare",
  "compare.swap": "Swap",
  "compare.summary": "Summary",
  "compare.metric": "Metric",
  "compare.delta": "Change",
  "compare.overlay": "Listening time comparison",
  "compare.sideBySide": "Side by side",
  "compare.sameShape":
    "Pick two periods of the same type (two months or two years) to overlay them.",
  "compare.noData": "No plays for this period.",

  // Trends
  "trends.title": "Trends",
  "trends.w7": "7 days",
  "trends.w30": "30 days",
  "trends.w90": "90 days",
  "trends.w365": "1 year",
  "trends.noRising": "No rising items in this window.",
  "trends.noFalling": "No falling items in this window.",
  "trends.noPrevious": "No previous period to compare with.",
  "trends.link": "See all trends",

  // History
  "history.title": "History",
  "history.daily": "Daily listening",
  "history.hourly": "Hourly breakdown",
  "history.hourlySubtitle": "Average per active day, over the selected period",
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
  "recap.downloadStory": "Story image (9:16)",
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
  "status.never": "never",
  "status.system": "System",
  "status.app": "Application",
  "status.version": "Version",
  "status.env": "Environment",
  "status.node": "Node.js",
  "status.uptime": "Uptime",
  "status.dbSize": "Database size",
  "status.autoSync": "Auto sync",
  "status.autoSyncOn": "enabled (every {minutes} min)",
  "status.autoSyncOff": "disabled (no SYNC_TOKEN)",
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
  "settings.export": "Export",
  "settings.exportHint": "Download your data",
  "settings.exportCsv": "History (CSV)",
  "settings.exportDb": "Database (.dump)",

  // Settings / user management (admin)
  "settings.users": "Users",
  "settings.usersSubtitle": "Accounts on this instance",
  "settings.userAdmin": "Admin",
  "settings.you": "You",
  "settings.userStats": "{plays} plays · {sources} source(s)",
  "settings.makeAdmin": "Make admin",
  "settings.removeAdmin": "Remove admin",
  "settings.deleteUser": "Delete",
  "settings.resetPassword": "Reset password",
  "settings.resetting": "Resetting…",
  "settings.changePassword": "Change password",
  "settings.currentPassword": "Current password",
  "settings.newPassword": "New password",
  "settings.passwordChanged": "Password updated.",
  "settings.passwordWrong": "Current password is incorrect.",
  "settings.invitations": "Invitations",
  "settings.invitationsSubtitle": "Invite people to create an account",
  "settings.inviteEmail": "Email (optional)",
  "settings.inviteEmailPlaceholder": "Restrict to this address",
  "settings.inviteDays": "Valid for",
  "settings.inviteDaysValue": "{days} day(s)",
  "settings.inviteCreate": "Create invitation",
  "settings.inviteCreating": "Creating…",
  "settings.inviteCreated": "Invitation link:",
  "settings.inviteNone": "No invitation.",
  "settings.anyEmail": "Any email",
  "settings.invitePending": "Pending",
  "settings.inviteUsed": "Used",
  "settings.inviteExpired": "Expired",
  "settings.inviteExpires": "Expires {date}",
  "settings.revoke": "Revoke",
  "settings.copy": "Copy",
  "settings.copied": "Copied!",

  // Spotify access requests
  "settings.spotifyAccount": "Spotify account (email or ID)",
  "settings.spotifyAccountPlaceholder": "you@spotify.com",
  "settings.spotifyAccessNeeded":
    "Spotify access must be approved by an administrator before you can connect. Enter your Spotify account so it can be authorised.",
  "settings.spotifyRequestCta": "Request Spotify access",
  "settings.spotifyRequesting": "Sending…",
  "settings.spotifyPending":
    "Request sent on {date}. Waiting for administrator approval.",
  "settings.spotifyRejected":
    "Your previous request was declined. You can send a new one.",
  "settings.spotifyAccountLabel": "Requested account: {account}",
  "settings.spotifyRequests": "Spotify access requests",
  "settings.spotifyRequestsSubtitle":
    "Approve the accounts you have added to your Spotify app",
  "settings.spotifyNoRequests": "No pending request.",
  "settings.spotifyApprove": "Approve",
  "settings.spotifyReject": "Reject",
  "settings.spotifyRevoke": "Revoke access",
  "settings.spotifyCancel": "Cancel request",
  "settings.spotifyApproved": "Approved",
  "settings.spotifyPendingBadge": "Pending",
  "settings.spotifyRejectedBadge": "Declined",
  "settings.confirmDeleteUser":
    "Delete “{name}”? All of their data will be removed.",
  "settings.confirmRevoke":
    "Revoke Spotify access for “{name}”? Their connection will be removed.",
  "settings.spotifyRequestedAt": "Requested {date}",

  // Recap sharing
  "settings.share": "Share recap",
  "settings.shareSubtitle": "Public read-only link to your recap",
  "settings.shareHint":
    "Anyone with the link can view your recap. You can disable it at any time.",
  "settings.shareEnable": "Enable sharing",
  "settings.shareDisable": "Disable sharing",
  "settings.shareRegenerate": "Regenerate link",
  "settings.shareLink": "Public link:",
  "settings.confirmUnshare":
    "Disable the public link? Existing links will stop working.",
  "share.kicker": "Shared recap",
  "share.footer": "Made with {name}",

  // Settings / connection action messages
  "msg.syncDone": "Sync done: {count} new play(s).",
  "msg.importDone":
    "Import done: {inserted} play(s) imported out of {total} read ({files} file(s)).",
  "msg.importDoneVisuals": " {count} artwork added.",
  "msg.enrichDone":
    "Artwork enriched: {albums}/{albumsChecked} album(s) and {artists}/{artistsChecked} artist(s).",
  "err.selectFile": "Select at least one JSON file.",
  "err.noHistory": "No playable history found in the selected files.",
  "err.importFailed": "Import failed.",
  "err.syncFailed": "Sync failed.",
  "err.connectionNotFound": "Connection not found.",
  "err.forbidden": "Not allowed.",
  "err.userNotFound": "User not found.",
  "err.spotifyAccountRequired": "Enter your Spotify account.",
  "msg.spotifyRequested":
    "Request sent. An administrator will validate it.",
  "msg.passwordReset":
    "Temporary password: {password} — share it securely, then have the user change it.",
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
  "notice.spotify_not_approved":
    "Your Spotify access has not been approved yet.",

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
  "track.noPlays": "No plays for this track in the selected period.",

  // Charts
  "chart.evolution": "Listening evolution",
  "chart.noData": "No data.",

  // Generic
  "generic.noData": "No data.",

  // Trends, heatmap & backups
  "dash.trends": "Trends",
  "dash.trendsSubtitle": "vs previous {days} days",
  "dash.rising": "Rising",
  "dash.falling": "Falling",
  "history.heatmap": "Yearly activity",
  "history.heatmapSubtitle": "Daily plays over the last 12 months",
  "status.backups": "Backups",
  "status.backupsValue": "{count} file(s)",

  "bytes.b": "B",
  "bytes.kb": "KB",
  "bytes.mb": "MB",
  "uptime.days": "{d}d {h}h",
  "uptime.hours": "{h}h {m}m",
  "uptime.minutes": "{m}m",

  // Onboarding (welcome modal + getting-started checklist)
  "onboard.subtitle": "Quick tour · {total} steps",
  "onboard.next": "Next",
  "onboard.prev": "Back",
  "onboard.finish": "Get started",
  "onboard.skip": "Skip",
  "onboard.step1.title": "Welcome 👋",
  "onboard.step1.body":
    "Statisfy turns your Spotify listening into clear, private statistics. Everything stays on your own instance.",
  "onboard.step2.title": "Connect Spotify",
  "onboard.step2.body":
    "In Settings, connect your Spotify account to sync your recent plays and genres automatically.",
  "onboard.step3.title": "Import your history",
  "onboard.step3.body":
    "For your full history, import your Spotify data export (Privacy). The import is idempotent — re-running it creates no duplicates.",
  "onboard.step4.title": "Explore",
  "onboard.step4.body":
    "Browse Rankings, Compare periods, Trends and your Recap. Have fun!",
  "checklist.title": "Getting started",
  "checklist.subtitle": "A few steps to get the most out of Statisfy",
  "checklist.connect": "Connect Spotify",
  "checklist.import": "Import your history",
  "checklist.explore": "Explore your rankings",
  "checklist.hide": "Hide",

  // Backup restore
  "settings.restore": "Restore a backup",
  "settings.restoreSubtitle": "Import a `.dump` file — replaces the current data",
  "settings.restoreHint":
    "A file created by “Database (.dump)” or found in the backups folder.",
  "settings.restoreCta": "Restore",
  "settings.restoring": "Restoring…",
  "settings.confirmRestore": "This replaces all current data. Continue?",
  "msg.restoreDone": "Backup restored.",
  "err.restoreFailed": "Restore failed (invalid or incompatible dump?).",
};
