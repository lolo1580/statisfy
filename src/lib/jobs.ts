import "server-only";

import { prisma } from "./db";

/**
 * Reprise des jobs bloqués en `running` après un crash ou un redémarrage.
 *
 * Un job n'est mis à jour qu'au démarrage et à la fin : au-delà de deux heures,
 * on considère qu'il est orphelin. Le seuil est volontairement large pour ne
 * pas interrompre une très grosse synchronisation légitime.
 */
const DEFAULT_STALE_MS = 2 * 60 * 60 * 1000;

export async function recoverStaleJobs(
  options: { olderThanMs?: number; userId?: string; now?: Date } = {},
): Promise<number> {
  const now = options.now ?? new Date();
  const cutoff = new Date(
    now.getTime() - (options.olderThanMs ?? DEFAULT_STALE_MS),
  );

  const result = await prisma.job
    .updateMany({
      where: {
        status: "running",
        startedAt: { lt: cutoff },
        ...(options.userId ? { userId: options.userId } : {}),
      },
      data: {
        status: "error",
        error: "Job interrompu (redémarrage ou perte de l'instance).",
        finishedAt: now,
      },
    })
    .catch(() => ({ count: 0 }));

  return result.count;
}
