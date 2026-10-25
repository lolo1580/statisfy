import "server-only";

import { cookies } from "next/headers";
import { isRangePreference, RANGE_COOKIE } from "./range";

/**
 * Période mémorisée par le navigateur (cookie `statisfy_range`).
 * Utilisée uniquement lorsqu'aucun `?range=` n'est présent dans l'URL.
 */
export async function preferredRange(): Promise<string | undefined> {
  const value = (await cookies()).get(RANGE_COOKIE)?.value;
  return isRangePreference(value) ? value : undefined;
}

/** `?range=` prioritaire, sinon la dernière période choisie. */
export async function resolveRangeParam(
  value: string | string[] | undefined,
): Promise<string | undefined> {
  if (typeof value === "string" && value) return value;
  return preferredRange();
}
