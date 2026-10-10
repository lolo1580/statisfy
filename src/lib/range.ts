/** Helpers de parsing d'URL (côté serveur, hors composants client). */

export function parseRange(value: string | undefined): {
  days: number | null;
  key: string;
} {
  if (!value || value === "all") return { days: null, key: "all" };
  const days = Number(value);
  if (!Number.isFinite(days) || days <= 0) return { days: 30, key: "30" };
  return { days, key: String(days) };
}

export function parseSource(value: string | undefined): string | null {
  if (!value || value === "all") return null;
  return value;
}
