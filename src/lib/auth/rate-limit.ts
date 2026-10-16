import "server-only";

import { headers } from "next/headers";
import { pickClientIp } from "../client-ip";

/**
 * Limiteur de débit côté requête : ré-exporte le store testable et fournit
 * l'adresse IP du client.
 */
export { resetTokens, takeToken } from "../rate-limit-store";

/**
 * Adresse IP du client (derrière un proxy si les en-têtes sont transmis), ou
 * `null` si elle n'est pas déterminable de façon fiable.
 *
 * On renvoie `null` — et jamais une valeur constante — quand les en-têtes de
 * proxy ne sont pas fiables (`TRUST_PROXY_HEADERS=false`) ou absents : une
 * valeur constante créerait un seau de rate-limit **partagé par tous les
 * clients**, transformant une limite par IP en blocage global (DoS).
 */
export async function clientIp(): Promise<string | null> {
  if (process.env.TRUST_PROXY_HEADERS === "false") return null;
  const headerList = await headers();
  const ip = pickClientIp(
    headerList.get("x-forwarded-for"),
    headerList.get("x-real-ip"),
  );
  return ip === "local" ? null : ip;
}
