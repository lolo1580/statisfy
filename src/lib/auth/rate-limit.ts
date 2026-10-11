import "server-only";

import { headers } from "next/headers";

/**
 * Limiteur de débit côté requête : ré-exporte le store testable et fournit
 * l'adresse IP du client.
 */
export { resetTokens, takeToken } from "../rate-limit-store";

/** Adresse IP du client (derrière un proxy si les en-têtes sont transmis). */
export async function clientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headerList.get("x-real-ip")?.trim() || "local";
}
