import "server-only";

import { prisma } from "../db";
import { decryptJson, encryptJson } from "../crypto";
import { getAdapter } from "../sources/registry";
import { parseSpotifyHistoryFiles } from "../sources/importer";
import type { RawPlay } from "../sources/types";
import { logEvent } from "../log";
import { sendWebhook } from "../webhook";
import { LockBusyError, withLock } from "../lock";
import { recoverStaleJobs } from "../jobs";
import { ingestPlays, type IngestResult, type IngestProgress } from "./ingest";

/** Options d'import : suivi d'avancement côté client (job + progression). */
export type RunImportOptions = {
  /** Identifiant de job fourni par le client (UUID) pour interroger l'avancement. */
  jobId?: string;
  onProgress?: (progress: IngestProgress) => void | Promise<void>;
};

/** Connexions en cours de synchronisation (verrou par connexion). */
const inFlight = new Set<string>();

/**
 * Synchronise une connexion source Spotify.
 *
 * Un verrou en mémoire par connexion empêche deux synchronisations simultanées
 * de la même source (cron + action manuelle, ou deux appels concurrents).
 */
export async function runSyncForConnection(
  connectionId: string,
): Promise<IngestResult> {
  if (inFlight.has(connectionId)) {
    throw new Error("Synchronisation déjà en cours pour cette connexion.");
  }
  inFlight.add(connectionId);
  try {
    // Verrou distribué : protège aussi contre une autre instance.
    return await withLock(`sync:${connectionId}`, () => runSync(connectionId));
  } catch (error) {
    if (error instanceof LockBusyError) {
      throw new Error(
        "Synchronisation déjà en cours pour cette connexion (autre instance).",
      );
    }
    throw error;
  } finally {
    inFlight.delete(connectionId);
  }
}

async function runSync(connectionId: string): Promise<IngestResult> {
  const connection = await prisma.sourceConnection.findUnique({
    where: { id: connectionId },
  });
  if (!connection) throw new Error("Connexion introuvable.");

  const adapter = getAdapter(connection.type);
  if (!adapter) throw new Error(`Source « ${connection.type} » non supportée.`);

  const job = await prisma.job.create({
    data: {
      userId: connection.userId,
      connectionId: connection.id,
      type: "sync",
      status: "running",
      startedAt: new Date(),
    },
  });

  let credentials: Record<string, unknown> = {};
  let credentialsBefore: string | null = null;
  try {
    try {
      credentials = connection.credentials
        ? decryptJson<Record<string, unknown>>(connection.credentials)
        : {};
    } catch {
      // AES-GCM échoue si la clé de chiffrement a changé (ou si la base
      // provient d'une autre instance) : message explicite pour l'UI.
      throw new Error(
        "Identifiants illisibles : CREDENTIALS_KEY a changé ou la base provient d'une autre instance. Supprimez puis reconnectez la source.",
      );
    }
    const config = connection.config
      ? (JSON.parse(connection.config) as Record<string, unknown>)
      : {};

    credentialsBefore = JSON.stringify(credentials);
    // Reprise basée sur la **dernière écoute ingérée** (+ léger recouvrement) et
    // non sur l'heure de synchro : évite de « sauter » des écoutes arrivées avec
    // du retard. `lastSyncedAt` reste le marqueur de throttle du cron.
    const watermark = connection.lastPlayAt ?? connection.lastSyncedAt;
    const since = watermark
      ? new Date(watermark.getTime() - 60 * 60 * 1000)
      : null;

    const plays = await adapter.fetchPlays({
      connectionId: connection.id,
      config,
      credentials,
      since,
    });

    const result = await ingestPlays(connection.userId, plays);

    const newestPlayedAt = plays.reduce<Date | null>(
      (max, play) => (!max || play.playedAt > max ? play.playedAt : max),
      null,
    );

    const updates: Record<string, unknown> = {
      lastSyncedAt: new Date(),
      lastError: null,
      status: "active",
    };
    if (newestPlayedAt) updates.lastPlayAt = newestPlayedAt;
    if (JSON.stringify(credentials) !== credentialsBefore) {
      updates.credentials = encryptJson(credentials);
    }
    await prisma.sourceConnection.update({
      where: { id: connection.id },
      data: updates,
    });

    if (result.inserted > 0) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "done",
          total: plays.length,
          processed: plays.length,
          inserted: result.inserted,
          finishedAt: new Date(),
        },
      });
    } else {
      // Aucune nouvelle écoute : on ne garde pas de job (cron fréquent).
      await prisma.job.delete({ where: { id: job.id } }).catch(() => undefined);
    }
    // Un webhook par synchronisation contenant des nouveautés (pas à chaque
    // passage du cron sans changement).
    if (result.inserted > 0) {
      await sendWebhook("sync.completed", {
        title: "Statisfy — synchronization",
        message: `🎧 ${result.inserted} new play(s) synced from ${connection.displayName}.`,
        userId: connection.userId,
        data: {
          connection: connection.displayName,
          source: connection.type,
          inserted: result.inserted,
          total: plays.length,
        },
      });
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    // Un jeton OAuth a pu être rafraîchi avant l'échec : on le persiste quand
    // même, sinon le refresh token (tourné par Spotify) serait perdu et les
    // synchronisations suivantes échoueraient.
    if (
      credentialsBefore !== null &&
      JSON.stringify(credentials) !== credentialsBefore
    ) {
      await prisma.sourceConnection
        .update({
          where: { id: connection.id },
          data: { credentials: encryptJson(credentials) },
        })
        .catch(() => undefined);
    }
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "error", error: message, finishedAt: new Date() },
    });
    await prisma.sourceConnection.update({
      where: { id: connection.id },
      data: { status: "error", lastError: message },
    });
    await logEvent({
      level: "error",
      source: "sync",
      message: "Échec de synchronisation",
      userId: connection.userId,
      meta: {
        connectionId: connection.id,
        connection: connection.displayName,
        error: message,
      },
    });
    await sendWebhook("sync.failed", {
      title: "Statisfy — synchronization failed",
      message: `⚠️ Sync failed for ${connection.displayName}: ${message}`,
      userId: connection.userId,
      data: {
        connection: connection.displayName,
        source: connection.type,
        error: message,
      },
    });
    throw error;
  }
}

/** Importe un ou plusieurs exports d'historique Spotify (JSON ou ZIP). */
export async function runImport(
  userId: string,
  files: Array<{ name: string; data: Uint8Array }>,
  options: RunImportOptions = {},
): Promise<IngestResult & { files: number }> {
  await recoverStaleJobs({ userId });

  const base = {
    userId,
    type: "import",
    status: "running",
    startedAt: new Date(),
  };
  // L'id fourni par le client peut déjà exister (double soumission) : on retombe
  // alors sur un id aléatoire ; l'import reste valide, seul le suivi est perdu.
  const job = await prisma.job
    .create({ data: options.jobId ? { ...base, id: options.jobId } : base })
    .catch(() => prisma.job.create({ data: base }));

  try {
    const { plays, files: parsedFiles } = parseSpotifyHistoryFiles(files);
    // Le total est connu après l'analyse : la barre passe d'indéterminée à
    // « n / total ».
    await prisma.job
      .update({ where: { id: job.id }, data: { total: plays.length } })
      .catch(() => undefined);

    const result = await ingestPlays(userId, plays, async (progress) => {
      await prisma.job
        .update({
          where: { id: job.id },
          data: {
            total: progress.total,
            processed: progress.processed,
            inserted: progress.inserted,
          },
        })
        .catch(() => undefined);
      await options.onProgress?.(progress);
    });

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "done",
        total: plays.length,
        processed: plays.length,
        inserted: result.inserted,
        finishedAt: new Date(),
      },
    });
    await sendWebhook("import.completed", {
      title: "Statisfy — import",
      message: `📥 ${result.inserted} play(s) imported from ${parsedFiles} file(s).`,
      userId,
      data: {
        inserted: result.inserted,
        total: plays.length,
        files: parsedFiles,
      },
    });
    return { ...result, files: parsedFiles };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "error", error: message, finishedAt: new Date() },
    });
    await logEvent({
      level: "error",
      source: "import",
      message: "Échec de l'import",
      userId,
      meta: { error: message },
    });
    await sendWebhook("import.failed", {
      title: "Statisfy — import failed",
      message: `⚠️ Import failed: ${message}`,
      userId,
      data: { error: message },
    });
    throw error;
  }
}

/** Synchronise toutes les connexions éligibles (utilisé par le cron). */
export async function syncAllDue(
  minIntervalMs = 20 * 60 * 1000,
): Promise<Array<{ id: string; ok: boolean; error?: string }>> {
  await recoverStaleJobs();

  const connections = await prisma.sourceConnection.findMany({
    where: { status: { in: ["active", "error"] } },
  });

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const connection of connections) {
    if (!getAdapter(connection.type)) continue;
    const due =
      !connection.lastSyncedAt ||
      Date.now() - connection.lastSyncedAt.getTime() > minIntervalMs;
    if (!due) continue;

    try {
      await runSyncForConnection(connection.id);
      results.push({ id: connection.id, ok: true });
    } catch (error) {
      results.push({
        id: connection.id,
        ok: false,
        error: error instanceof Error ? error.message : "Erreur inconnue",
      });
    }
  }
  return results;
}

/** Ingère un lot d'écoutes déjà normalisées (imports personnalisés). */
export async function runPlaysIngest(
  userId: string,
  plays: RawPlay[],
  options: RunImportOptions = {},
): Promise<IngestResult> {
  await recoverStaleJobs({ userId });

  const base = {
    userId,
    type: "import",
    status: "running",
    startedAt: new Date(),
  };
  const job = await prisma.job
    .create({ data: options.jobId ? { ...base, id: options.jobId } : base })
    .catch(() => prisma.job.create({ data: base }));
  try {
    await prisma.job
      .update({ where: { id: job.id }, data: { total: plays.length } })
      .catch(() => undefined);
    const result = await ingestPlays(userId, plays, async (progress) => {
      await prisma.job
        .update({
          where: { id: job.id },
          data: {
            total: progress.total,
            processed: progress.processed,
            inserted: progress.inserted,
          },
        })
        .catch(() => undefined);
      await options.onProgress?.(progress);
    });
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "done",
        total: plays.length,
        processed: plays.length,
        inserted: result.inserted,
        finishedAt: new Date(),
      },
    });
    await sendWebhook("import.completed", {
      title: "Statisfy — import",
      message: `📥 ${result.inserted} play(s) imported.`,
      userId,
      data: { inserted: result.inserted, total: plays.length },
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "error", error: message, finishedAt: new Date() },
    });
    await logEvent({
      level: "error",
      source: "import",
      message: "Échec de l'import",
      userId,
      meta: { error: message },
    });
    await sendWebhook("import.failed", {
      title: "Statisfy — import failed",
      message: `⚠️ Import failed: ${message}`,
      userId,
      data: { error: message },
    });
    throw error;
  }
}
