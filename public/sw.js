/**
 * Service worker minimal (PWA installable).
 *
 * Aucun cache : les pages contiennent des données privées et doivent toujours
 * venir du réseau. Le `fetch` handler est volontairement un no-op ; il permet
 * seulement de remplir les critères d'installabilité des navigateurs.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Réseau uniquement : pas de cache hors ligne.
});
