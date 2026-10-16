/**
 * Primitives pures des mises à jour optimistes.
 *
 * Ce module est volontairement sans dépendance serveur : il est importé par
 * les composants clients (pour le réducteur) **et** par les Server Actions
 * (pour typer leur résultat). Rester pur le rend testable unitairement.
 */

/** Tout élément d'une liste optimiste doit porter un identifiant stable. */
export type OptimisticRecord = { id: string };

/**
 * Champs ajoutés côté client pour signaler qu'une ligne est en cours de
 * synchronisation. Ils disparaissent d'eux-mêmes lorsque la mutation est
 * confirmée ou annulée (React retire la couche optimiste).
 */
export type OptimisticMeta = {
  /** `true` tant que la mutation correspondante n'est pas confirmée. */
  syncing?: boolean;
};

export type OptimisticAction<Item extends OptimisticRecord> =
  | { type: "add"; item: Item; position?: "start" | "end" }
  | { type: "update"; id: string; patch: Partial<Item> }
  | { type: "remove"; id: string };

/**
 * Réducteur pur appliqué par `useOptimistic`. Toutes les actions sont
 * additives : React ré-exécute la file d'actions au-dessus des données serveur
 * fraîches, si bien qu'un rafraîchissement en arrière-plan ré-applique la
 * modification en cours sur la nouvelle base.
 */
export function optimisticReducer<Item extends OptimisticRecord>(
  items: Item[],
  action: OptimisticAction<Item>,
): Item[] {
  switch (action.type) {
    case "add":
      return action.position === "start"
        ? [action.item, ...items]
        : [...items, action.item];
    case "update":
      return items.map((item) =>
        item.id === action.id ? { ...item, ...action.patch } : item,
      );
    case "remove":
      return items.filter((item) => item.id !== action.id);
  }
}

/**
 * Identifiant temporaire attribué à une ligne créée avant que le serveur
 * n'ait renvoyé son identifiant définitif.
 */
export function createTempId(prefix = "tmp"): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${uuid}`;
}

/**
 * Résultat d'une Server Action. `error` déclenche un rollback côté client ;
 * une absence d'erreur est traitée comme un succès.
 */
export type MutationOutcome = { ok?: boolean; error?: string };

/**
 * Message lisible à partir d'une exception quelconque. Les `Error` non gérés
 * proviennent de l'infrastructure (réseau, serveur) : on préfère un message
 * localisé plutôt qu'une chaîne technique anglaise. Une chaîne lancée
 * explicitement est conservée.
 */
export function describeError(error: unknown, fallback: string): string {
  if (typeof error === "string" && error) return error;
  return fallback;
}
