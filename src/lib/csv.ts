/**
 * Génération CSV sûre.
 *
 * `csvCell` échappe les guillemets/virgules/retours ligne **et** neutralise les
 * formules tableur : une cellule commençant par `=`, `+`, `-`, `@`, tabulation
 * ou retour chariot est préfixée d'une apostrophe (injection de formule).
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}
