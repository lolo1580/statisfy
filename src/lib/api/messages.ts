/**
 * Messages d'erreur de l'API publique, localisés à partir de l'en-tête
 * `Accept-Language` (français si le client le demande, anglais par défaut).
 *
 * Chaque réponse porte aussi un `code` stable, indépendant de la langue, pour
 * que les clients puissent brancher leur logique dessus sans comparer du texte.
 */

export type ApiLocale = "en" | "fr";

export const API_MESSAGES = {
  en: {
    unauthorized: "Unauthorized",
    unauthorizedHint:
      "Provide ?token=<stats API token> or Authorization: Bearer <token>.",
    rateLimited: "Too many requests, try again later.",
    invalidRange:
      "Invalid range: use today, week, month, year, all or a number of days between 1 and 3660.",
  },
  fr: {
    unauthorized: "Non autorisé.",
    unauthorizedHint:
      "Fournissez ?token=<jeton de l'API> ou l'en-tête Authorization: Bearer <jeton>.",
    rateLimited: "Trop de requêtes, réessayez plus tard.",
    invalidRange:
      "Période invalide : utilisez today, week, month, year, all ou un nombre de jours entre 1 et 3660.",
  },
} as const satisfies Record<ApiLocale, Record<string, string>>;

export type ApiMessageKey = keyof (typeof API_MESSAGES)["en"];

/** Première langue supportée de `Accept-Language` (anglais par défaut). */
export function apiLocale(request: Request): ApiLocale {
  const header = request.headers.get("accept-language");
  if (!header) return "en";

  for (const part of header.split(",")) {
    const [tag, ...params] = part.trim().toLowerCase().split(";");
    const weight = params
      .map((param) => param.trim())
      .find((param) => param.startsWith("q="));
    if (weight && Number(weight.slice(2)) === 0) continue;
    if (tag === "fr" || tag.startsWith("fr-")) return "fr";
    if (tag === "en" || tag.startsWith("en-")) return "en";
  }
  return "en";
}

/** Message traduit pour la requête. */
export function apiMessage(request: Request, key: ApiMessageKey): string {
  return API_MESSAGES[apiLocale(request)][key];
}
