import "server-only";

import { headers } from "next/headers";
import { pickClientIp } from "../client-ip";

/**
 * Limiteur de débit côté requête : ré-exporte le store testable et fournit
 * l'adresse IP du client.
 */
export { resetTokens, takeToken } from "../rate-limit-store";

/**
 * Adresse IP du client (derrière un proxy si les en-têtes sont transmis).
 * Les valeurs sont validées comme IP réelles : un en-tête forgé ou malformé ne
 * peut ni contourner le rate-limit par une clé arbitraire, ni injecter de texte
 * dans les journaux.
 */
export async function clientIp(): Promise<string> {
  // Par défaut, on fait confiance aux en-têtes de proxy (déploiement derrière un
  // reverse proxy). Mettre `TRUST_PROXY_HEADERS=false` si l'app est exposée
  // directement, afin d'ignorer des en-têtes `X-Forwarded-For` forgés.
  if (process.env.TRUST_PROXY_HEADERS === "false") return "local";
  const headerList = await headers();
  return pickClientIp(
    headerList.get("x-forwarded-for"),
    headerList.get("x-real-ip"),
  );
}
