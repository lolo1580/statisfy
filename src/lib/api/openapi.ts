import { appVersion } from "../env";
import { buildComponents } from "./openapi/components";
import { buildPaths } from "./openapi/paths";

/**
 * Spécification OpenAPI servie par `GET /api/docs/openapi.json` et rendue par
 * la page Swagger UI `/api-docs`.
 *
 * Le document est découpé en trois parties :
 * - `openapi/responses`  : réponses d'erreur réutilisables ;
 * - `openapi/paths`      : description des routes ;
 * - `openapi/components` : schémas et mécanismes de sécurité.
 *
 * On la garde en TypeScript (plutôt qu'un YAML statique) pour que la version de
 * l'application et les exemples restent à portée de main du code.
 */
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
    paths: buildPaths(),
    components: buildComponents(),
  };
}
