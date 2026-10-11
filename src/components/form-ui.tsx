/**
 * Petits éléments partagés par les formulaires (champ de saisie + retour
 * d'action serveur), pour éviter la duplication entre `auth-forms`,
 * `settings-forms` et `admin-forms`.
 */

export const inputClass =
  "w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted/70 focus:border-accent";

export function Feedback({
  state,
}: {
  state: { error?: string; message?: string } | undefined;
}) {
  if (!state) return null;
  if (state.error) return <p className="text-sm text-red-400">{state.error}</p>;
  if (state.message)
    return <p className="text-sm text-accent">{state.message}</p>;
  return null;
}
