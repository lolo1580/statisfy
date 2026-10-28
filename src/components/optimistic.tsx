"use client";

import { startTransition, useCallback, useOptimistic, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import {
  describeError,
  optimisticReducer,
  type MutationOutcome,
  type OptimisticAction,
  type OptimisticRecord,
} from "@/lib/optimistic";

export type { MutationOutcome };

/** Base stable : ne jamais recréer le `Set`, sinon React réinitialise l'optimisme. */
const EMPTY_PENDING: ReadonlySet<string> = new Set<string>();

export type OptimisticList<Item extends OptimisticRecord> = {
  /** Liste affichée : données serveur + modifications optimistes en attente. */
  items: Item[];
  /** Message d'erreur par ligne (clé = identifiant, `"new"` pour les créations). */
  errors: Record<string, string>;
  dismissError: (key: string) => void;
  /** `true` tant qu'une mutation pour cette clé est en vol. */
  isPending: (key: string) => boolean;
  create: (
    item: Item,
    mutate: () => Promise<MutationOutcome>,
    options?: { key?: string; position?: "start" | "end" },
  ) => void;
  update: (
    id: string,
    patch: Partial<Item>,
    mutate: () => Promise<MutationOutcome>,
  ) => void;
  remove: (id: string, mutate: () => Promise<MutationOutcome>) => void;
};

/**
 * Gère une liste serveur avec des mises à jour optimistes.
 *
 * Chaque mutation (`create`/`update`/`remove`) est appliquée immédiatement
 * dans une transition, puis la Server Action est appelée. Si elle renvoie une
 * erreur ou lève, la modification est automatiquement annulée (React retire la
 * couche optimiste en fin de transition) et le message est conservé par ligne.
 */
export function useOptimisticList<Item extends OptimisticRecord>(
  initialItems: Item[],
  options: { fallbackError?: string } = {},
): OptimisticList<Item> {
  const fallbackError = options.fallbackError ?? "Something went wrong.";

  const [items, applyOptimistic] = useOptimistic(
    initialItems,
    (state: Item[], action: OptimisticAction<Item>) =>
      optimisticReducer(state, action),
  );

  const [pendingKeys, markPending] = useOptimistic(
    EMPTY_PENDING,
    (state: ReadonlySet<string>, key: string) => {
      const next = new Set(state);
      next.add(key);
      return next;
    },
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const dismissError = useCallback((key: string) => {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const run = useCallback(
    (
      action: OptimisticAction<Item>,
      key: string,
      mutate: () => Promise<MutationOutcome>,
    ) => {
      dismissError(key);
      startTransition(async () => {
        // Optimisme : appliqué sur la frame courante.
        applyOptimistic(action);
        markPending(key);

        let outcome: MutationOutcome;
        try {
          outcome = await mutate();
        } catch (error) {
          // Laisse passer les exceptions de contrôle de flux Next.js
          // (redirection vers /login si la session a expiré…).
          unstable_rethrow(error);
          outcome = { error: describeError(error, fallbackError) };
        }

        if (outcome.error) {
          const message = outcome.error;
          // Après un `await`, un setter n'est plus rattaché à la transition :
          // on en ouvre une nouvelle pour appliquer l'erreur immédiatement.
          startTransition(() => {
            setErrors((prev) => ({ ...prev, [key]: message }));
          });
        }
      });
    },
    [applyOptimistic, dismissError, fallbackError, markPending],
  );

  const create = useCallback<OptimisticList<Item>["create"]>(
    (item, mutate, createOptions) =>
      run(
        { type: "add", item, position: createOptions?.position },
        createOptions?.key ?? "new",
        mutate,
      ),
    [run],
  );

  const update = useCallback<OptimisticList<Item>["update"]>(
    (id, patch, mutate) => run({ type: "update", id, patch }, id, mutate),
    [run],
  );

  const remove = useCallback<OptimisticList<Item>["remove"]>(
    (id, mutate) => run({ type: "remove", id }, id, mutate),
    [run],
  );

  const isPending = useCallback(
    (key: string) => pendingKeys.has(key),
    [pendingKeys],
  );

  return { items, errors, dismissError, isPending, create, update, remove };
}

/** Petit indicateur de synchronisation discret. */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}
