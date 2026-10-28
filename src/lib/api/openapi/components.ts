import { tooManyRequestsResponse, unauthorizedResponse } from "./responses";

/** Schémas et mécanismes d'authentification réutilisables. */
export function buildComponents(): Record<string, unknown> {
  return {
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
  };
}
