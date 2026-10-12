import "server-only";

import { headers } from "next/headers";

/**
 * Limiteur de débit côté requête : ré-exporte le store testable et fournit
 * l'adresse IP du client.
 */
export { resetTokens, takeToken } from "../rate-limit-store";

/** Adresse IP du client (derrière un proxy si les en-têtes sont transmis). */
export async function clientIp(): Promise<string> {
  // Par défaut, on fait confiance aux en-têtes de proxy (déploiement derrière un
  // reverse proxy). Mettre `TRUST_PROXY_HEADERS=false` si l'app est exposée
  // directement, afin d'ignorer des en-têtes `X-Forwarded-For` forgés.
  if (process.env.TRUST_PROXY_HEADERS === "false") return "local";
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    // On retient le **dernier** saut (ajouté par le proxy le plus proche) :
    // la valeur la plus à gauche peut être forgée par le client.
    if (parts.length > 0) return parts[parts.length - 1]!;
  }
  return headerList.get("x-real-ip")?.trim() || "local";
}
