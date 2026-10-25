import { appVersion } from "../env";

/**
 * Spécification OpenAPI servie par `GET /api/docs/openapi.json` et rendue par
 * la page Swagger UI `/api-docs`.
 *
 * On la garde en TypeScript (plutôt qu'un YAML statique) pour que la version de
 * l'application et les exemples restent à portée de main du code.
 */

const errorResponse = {
  description: "Requête invalide ou non autorisée.",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
} as const;

const unauthorizedResponse = {
  description: "Jeton absent, invalide ou révoqué.",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
} as const;

const tooManyRequestsResponse = {
  description: "Quota de requêtes dépassé.",
  headers: {
    "Retry-After": {
      description: "Délai d'attente conseillé, en secondes.",
      schema: { type: "integer", example: 60 },
    },
  },
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
} as const;

const binaryBody = (description: string) => ({
  required: true,
  description,
  content: {
    "application/octet-stream": {
      schema: { type: "string", format: "binary" },
    },
  },
});

export function getOpenApiSpec(): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "Statisfy API",
      version: appVersion,
      description:
        "API de Statisfy : statistiques d'écoute en lecture seule, synchronisation, imports et sauvegardes.\n\n" +
        "Les routes d'administration acceptent le jeton global `SYNC_TOKEN` " +
        "(`Authorization: Bearer <SYNC_TOKEN>`) ou une session administrateur. " +
        "Les routes publiques utilisent un jeton propre au compte, généré dans " +
        "« Réglages → Données personnelles ».",
      license: { name: "GPL-3.0-only" },
    },
    servers: [{ url: "/", description: "Instance courante" }],
    tags: [
      { name: "Public", description: "Statistiques en lecture seule." },
      { name: "Synchronisation", description: "Déclenchement et suivi." },
      { name: "Imports", description: "Import d'historiques Spotify." },
      { name: "Exports", description: "Exports CSV et PostgreSQL." },
      { name: "Administration", description: "Journaux, sauvegardes, OAuth." },
    ],
    paths: {
      "/api/public/stats": {
        get: {
          tags: ["Public"],
          summary: "Statistiques d'écoute d'un compte",
          description:
            "Renvoie des statistiques agrégées, sans données brutes ni informations " +
            "personnelles au-delà du nom affiché. La réponse est volontairement " +
            "plate pour être mappée directement dans un widget `customapi` de Homepage.",
          operationId: "getPublicStats",
          security: [{ statsToken: [] }, { statsQueryToken: [] }],
          parameters: [
            {
              name: "range",
              in: "query",
              description:
                "Période analysée : `today`, `week`, `month`, `year`, `all`, ou un nombre de jours (1–3660). Défaut : `30`.",
              required: false,
              schema: { type: "string", default: "30", example: "30" },
            },
            {
              name: "token",
              in: "query",
              description:
                "Jeton d'API du compte. Alternative à l'en-tête `Authorization: Bearer`.",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Statistiques du compte.",
              headers: {
                "Cache-Control": {
                  description: "Cache privé de 60 secondes.",
                  schema: { type: "string", example: "private, max-age=60" },
                },
              },
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Stats" },
                },
              },
            },
            "401": unauthorizedResponse,
            "429": tooManyRequestsResponse,
          },
        },
      },
      "/api/public/stats/card.svg": {
        get: {
          tags: ["Public"],
          summary: "Carte SVG des statistiques",
          description:
            "Génère un badge SVG (480×180) avec les heures d'écoute, le total " +
            "d'écoutes, l'activité sur 7 jours et l'artiste du dessus. Aucune " +
            "ressource externe : le SVG peut être affiché dans un README ou une page.",
          operationId: "getPublicStatsCard",
          security: [{ statsToken: [] }, { statsQueryToken: [] }],
          parameters: [
            {
              name: "range",
              in: "query",
              description: "Période utilisée pour l'artiste du dessus. Défaut : `30`.",
              required: false,
              schema: { type: "string", default: "30" },
            },
            {
              name: "theme",
              in: "query",
              description: "Thème de la carte.",
              required: false,
              schema: { type: "string", enum: ["dark", "light"], default: "dark" },
            },
            {
              name: "locale",
              in: "query",
              description: "Langue des libellés et format des nombres.",
              required: false,
              schema: { type: "string", enum: ["en", "fr"], default: "en" },
            },
            {
              name: "token",
              in: "query",
              description: "Jeton d'API du compte.",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Carte SVG.",
              content: {
                "image/svg+xml": { schema: { type: "string" } },
              },
            },
            "401": unauthorizedResponse,
            "429": tooManyRequestsResponse,
          },
        },
      },
      "/api/sync": {
        get: {
          tags: ["Synchronisation"],
          summary: "Synchroniser les sources dues",
          description:
            "Déclenche la synchronisation de toutes les sources arrivées à échéance. " +
            "`GET` n'accepte que le jeton global (jamais la session, pour éviter un " +
            "déclenchement par simple navigation).",
          operationId: "syncSources",
          security: [{ syncToken: [] }],
          responses: {
            "200": {
              description: "Résultat de la synchronisation.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SyncResult" },
                },
              },
            },
            "401": unauthorizedResponse,
          },
        },
        post: {
          tags: ["Synchronisation"],
          summary: "Synchroniser les sources dues",
          description:
            "Identique à `GET`, mais accepte aussi une session administrateur. " +
            "C'est la forme recommandée pour un cron.",
          operationId: "syncSourcesPost",
          security: [{ syncToken: [] }, { session: [] }],
          responses: {
            "200": {
              description: "Résultat de la synchronisation.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SyncResult" },
                },
              },
            },
            "401": unauthorizedResponse,
          },
        },
      },
      "/api/backup": {
        post: {
          tags: ["Administration"],
          summary: "Sauvegarder la base PostgreSQL",
          description:
            "Crée un dump `pg_dump` de la base complète. Réservé aux administrateurs.",
          operationId: "createBackup",
          security: [{ syncToken: [] }, { session: [] }],
          responses: {
            "200": {
              description: "Dump PostgreSQL.",
              content: {
                "application/octet-stream": {
                  schema: { type: "string", format: "binary" },
                },
              },
            },
            "401": unauthorizedResponse,
            "500": errorResponse,
          },
        },
      },
      "/api/restore": {
        post: {
          tags: ["Administration"],
          summary: "Restaurer un dump PostgreSQL",
          description:
            "Remplace les données actuelles par le dump fourni. Opération destructive, " +
            "réservée aux administrateurs.",
          operationId: "restoreBackup",
          security: [{ syncToken: [] }, { session: [] }],
          requestBody: binaryBody("Dump `pg_dump` au format personnalisé (`.dump`)."),
          responses: {
            "200": {
              description: "Restauration terminée.",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
            "401": unauthorizedResponse,
            "413": errorResponse,
          },
        },
      },
      "/api/export": {
        get: {
          tags: ["Exports"],
          summary: "Exporter l'historique du compte en CSV",
          description:
            "Export complet de l'historique de l'utilisateur connecté, en streaming.",
          operationId: "exportCsv",
          security: [{ session: [] }],
          responses: {
            "200": {
              description: "Fichier CSV.",
              content: {
                "text/csv": { schema: { type: "string" } },
              },
            },
            "401": unauthorizedResponse,
            "429": tooManyRequestsResponse,
          },
        },
      },
      "/api/export/db": {
        get: {
          tags: ["Exports"],
          summary: "Télécharger un dump complet de la base",
          description:
            "Dump `pg_dump` de toute l'instance (tous les comptes). Réservé aux administrateurs.",
          operationId: "exportDatabase",
          security: [{ syncToken: [] }, { session: [] }],
          responses: {
            "200": {
              description: "Dump PostgreSQL.",
              content: {
                "application/octet-stream": {
                  schema: { type: "string", format: "binary" },
                },
              },
            },
            "401": unauthorizedResponse,
            "500": errorResponse,
          },
        },
      },
      "/api/import/spotify-history": {
        post: {
          tags: ["Imports"],
          summary: "Importer un export Spotify",
          description:
            "Importe une archive « Extended streaming history » de Spotify (ZIP) ou " +
            "un fichier JSON de streaming. Idempotent grâce aux clés de déduplication.",
          operationId: "importSpotifyHistory",
          security: [{ syncToken: [] }, { basicAuth: [] }, { session: [] }],
          requestBody: binaryBody(
            "Archive ZIP de Spotify ou fichier `Streaming_History_Audio_*.json`.",
          ),
          responses: {
            "200": {
              description: "Import terminé.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ImportResult" },
                },
              },
            },
            "401": unauthorizedResponse,
            "413": errorResponse,
            "429": tooManyRequestsResponse,
          },
        },
      },
      "/api/import/your-spotify": {
        post: {
          tags: ["Imports"],
          summary: "Importer un dump « Your Spotify »",
          description:
            "Importe une archive ZIP produite par Your Spotify. L'utilisateur cible " +
            "est celui de la session ou des identifiants Basic ; avec `SYNC_TOKEN`, " +
            "le compte est choisi par l'en-tête `X-User-Email` (ou le seul compte existant).",
          operationId: "importYourSpotify",
          security: [{ syncToken: [] }, { basicAuth: [] }, { session: [] }],
          parameters: [
            {
              name: "X-Filename",
              in: "header",
              description: "Nom de fichier d'origine (facultatif, pour les journaux).",
              required: false,
              schema: { type: "string" },
            },
            {
              name: "X-User-Email",
              in: "header",
              description:
                "Compte cible lorsque l'authentification utilise `SYNC_TOKEN`.",
              required: false,
              schema: { type: "string", format: "email" },
            },
          ],
          requestBody: binaryBody("Archive ZIP Your Spotify."),
          responses: {
            "200": {
              description: "Import terminé.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ImportResult" },
                },
              },
            },
            "401": unauthorizedResponse,
            "413": errorResponse,
            "429": tooManyRequestsResponse,
          },
        },
      },
      "/api/admin/logs/export": {
        get: {
          tags: ["Administration"],
          summary: "Exporter les journaux d'événements",
          description: "Export CSV ou JSON des journaux, avec filtres.",
          operationId: "exportLogs",
          security: [{ syncToken: [] }, { session: [] }],
          parameters: [
            {
              name: "format",
              in: "query",
              schema: { type: "string", enum: ["csv", "json"], default: "csv" },
            },
            {
              name: "level",
              in: "query",
              description: "Niveau de gravité.",
              schema: { type: "string", enum: ["debug", "info", "warn", "error"] },
            },
            {
              name: "source",
              in: "query",
              description: "Source du journal (ex. `sync`, `import`, `auth`).",
              schema: { type: "string" },
            },
            {
              name: "q",
              in: "query",
              description: "Recherche plein texte dans le message.",
              schema: { type: "string" },
            },
            {
              name: "from",
              in: "query",
              description: "Date de début (ISO 8601).",
              schema: { type: "string", format: "date-time" },
            },
            {
              name: "to",
              in: "query",
              description: "Date de fin (ISO 8601).",
              schema: { type: "string", format: "date-time" },
            },
          ],
          responses: {
            "200": {
              description: "Export des journaux.",
              content: {
                "text/csv": { schema: { type: "string" } },
                "application/json": { schema: { type: "array", items: { type: "object" } } },
              },
            },
            "401": unauthorizedResponse,
            "429": tooManyRequestsResponse,
          },
        },
      },
      "/api/jobs/{id}": {
        get: {
          tags: ["Synchronisation"],
          summary: "Suivre un import en cours",
          description:
            "Avancement d'un job d'import appartenant à l'utilisateur connecté.",
          operationId: "getJob",
          security: [{ session: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "État du job.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/JobProgress" },
                },
              },
            },
            "401": unauthorizedResponse,
            "404": errorResponse,
          },
        },
      },
      "/api/wrapped/image": {
        get: {
          tags: ["Exports"],
          summary: "Image PNG du récapitulatif",
          description:
            "Génère une image partageable du récapitulatif (année ou mois). " +
            "Nécessite une session.",
          operationId: "getWrappedImage",
          security: [{ session: [] }],
          parameters: [
            {
              name: "year",
              in: "query",
              schema: { type: "integer", example: 2026 },
            },
            {
              name: "month",
              in: "query",
              description: "Mois (1–12). Absent = année complète.",
              schema: { type: "integer", minimum: 1, maximum: 12 },
            },
            {
              name: "format",
              in: "query",
              description: "`story` pour le format vertical, sinon carte paysage.",
              schema: { type: "string", enum: ["story"] },
            },
          ],
          responses: {
            "200": {
              description: "Image PNG.",
              content: { "image/png": { schema: { type: "string", format: "binary" } } },
            },
            "401": unauthorizedResponse,
            "429": tooManyRequestsResponse,
          },
        },
      },
      "/api/wrapped/og": {
        get: {
          tags: ["Exports"],
          summary: "Image Open Graph d'un récap partagé",
          description:
            "Génère l'image 1200×630 utilisée pour l'aperçu social d'un récap " +
            "partagé. Le jeton de partage fait office de capability ; aucune " +
            "session n'est requise.",
          operationId: "getWrappedOpenGraphImage",
          parameters: [
            { name: "token", in: "query", required: true, schema: { type: "string" } },
            { name: "year", in: "query", schema: { type: "integer", example: 2026 } },
            { name: "month", in: "query", schema: { type: "integer", minimum: 1, maximum: 12 } },
            {
              name: "locale",
              in: "query",
              schema: { type: "string", enum: ["en", "fr"], default: "en" },
            },
          ],
          responses: {
            "200": {
              description: "Image PNG 1200×630.",
              content: { "image/png": { schema: { type: "string", format: "binary" } } },
            },
            "404": errorResponse,
            "429": tooManyRequestsResponse,
          },
        },
      },
      "/api/icon": {
        get: {
          tags: ["Public"],
          summary: "Icône PWA générée",
          operationId: "getPwaIcon",
          parameters: [
            {
              name: "size",
              in: "query",
              description: "Taille en pixels (64–512, défaut 512).",
              schema: { type: "integer", minimum: 64, maximum: 512, default: 512 },
            },
          ],
          responses: {
            "200": {
              description: "Icône PNG.",
              content: { "image/png": { schema: { type: "string", format: "binary" } } },
            },
          },
        },
      },
      "/manifest.webmanifest": {
        get: {
          tags: ["Public"],
          summary: "Manifeste PWA",
          operationId: "getWebManifest",
          responses: {
            "200": {
              description: "Manifeste de l'application installable.",
              content: {
                "application/manifest+json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
      },
      "/api/sources/spotify/start": {
        get: {
          tags: ["Administration"],
          summary: "Démarrer l'authentification Spotify",
          description:
            "Redirige vers l'écran d'autorisation Spotify (PKCE). Nécessite une session.",
          operationId: "startSpotifyOAuth",
          security: [{ session: [] }],
          responses: {
            "302": { description: "Redirection vers Spotify." },
            "401": unauthorizedResponse,
          },
        },
      },
    },
    components: {
      securitySchemes: {
        statsToken: {
          type: "http",
          scheme: "bearer",
          description:
            "Jeton d'API du compte (`User.statsApiToken`), généré dans « Réglages → Données personnelles ».",
        },
        statsQueryToken: {
          type: "apiKey",
          in: "query",
          name: "token",
          description:
            "Même jeton, en paramètre d'URL : pratique pour les widgets qui ne peuvent pas envoyer d'en-tête (Homepage).",
        },
        syncToken: {
          type: "http",
          scheme: "bearer",
          description: "Jeton global `SYNC_TOKEN` de l'instance.",
        },
        basicAuth: {
          type: "http",
          scheme: "basic",
          description: "E-mail et mot de passe d'un compte Statisfy.",
        },
        session: {
          type: "apiKey",
          in: "cookie",
          name: "statisfy_session",
          description: "Session navigateur (cookie signé).",
        },
      },
      responses: {
        Unauthorized: unauthorizedResponse,
        TooManyRequests: tooManyRequestsResponse,
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string", example: "Unauthorized" },
            hint: { type: "string" },
          },
          required: ["error"],
        },
        Stats: {
          type: "object",
          description:
            "Statistiques agrégées. Les champs plats sont directement mappables dans Homepage.",
          properties: {
            user: { type: "string", example: "Laurent" },
            generatedAt: { type: "string", format: "date-time" },
            range: {
              type: "string",
              description: "Période effectivement appliquée.",
              example: "30",
            },
            rangeFrom: {
              type: ["string", "null"],
              format: "date-time",
              description:
                "Borne basse explicite de la période (`null` pour une période glissante ou tout l'historique).",
            },
            plays: {
              type: "integer",
              description: "Écoutes comptées sur la période.",
              example: 1800,
            },
            listeningMs: {
              type: "integer",
              description: "Temps d'écoute sur la période, en millisecondes.",
              example: 500000000,
            },
            hours: {
              type: "number",
              description: "Temps d'écoute sur la période, en heures (0,1 près).",
              example: 138.9,
            },
            artists: { type: "integer", example: 210 },
            tracks: { type: "integer", example: 1200 },
            albums: { type: "integer", example: 340 },
            allTimePlays: {
              type: "integer",
              description: "Écoutes comptées depuis toujours.",
              example: 48213,
            },
            allTimeHours: { type: "number", example: 3120.5 },
            lastPlayAt: {
              type: ["string", "null"],
              format: "date-time",
              description: "Dernière écoute connue.",
            },
            todayPlays: { type: "integer", example: 12 },
            todayHours: { type: "number", example: 0.9 },
            weekPlays: { type: "integer", example: 412 },
            weekHours: { type: "number", example: 30.2 },
            monthPlays: { type: "integer", example: 1800 },
            monthHours: { type: "number", example: 138.9 },
            topArtist: { type: ["string", "null"], example: "Radiohead" },
            topArtistPlays: { type: ["integer", "null"], example: 41 },
            topArtistImage: {
              type: ["string", "null"],
              format: "uri",
              example: "https://i.scdn.co/image/…",
            },
            topTrack: { type: ["string", "null"], example: "Weird Fishes" },
            topTrackArtist: { type: ["string", "null"], example: "Radiohead" },
            topTrackPlays: { type: ["integer", "null"], example: 12 },
            topTrackImage: { type: ["string", "null"], format: "uri" },
          },
          required: [
            "user",
            "generatedAt",
            "range",
            "plays",
            "hours",
            "allTimePlays",
            "allTimeHours",
          ],
        },
        SyncResult: {
          type: "object",
          properties: {
            synced: { type: "integer", example: 1 },
            failed: { type: "integer", example: 0 },
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  ok: { type: "boolean" },
                  inserted: { type: "integer" },
                  error: { type: "string" },
                },
              },
            },
          },
        },
        ImportResult: {
          type: "object",
          properties: {
            total: { type: "integer", description: "Lignes lues." },
            inserted: { type: "integer", description: "Écoutes insérées." },
            skipped: { type: "integer" },
            files: { type: "integer" },
          },
        },
        JobProgress: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["pending", "running", "done", "error"],
            },
            total: { type: "integer" },
            processed: { type: "integer" },
            inserted: { type: "integer" },
            error: { type: ["string", "null"] },
          },
        },
      },
    },
  };
}
