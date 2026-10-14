import "server-only";

import { prisma } from "./db";
import { forwardToSink } from "./log-sink";

/** Niveaux de gravité du journal (du plus verbeux au plus critique). */
export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Origine fonctionnelle d'une entrée. */
export const LOG_SOURCES = [
  "auth",
  "admin",
  "sync",
  "import",
  "backup",
  "source",
  "system",
] as const;
export type LogSource = (typeof LOG_SOURCES)[number];

export function isLogLevel(value: unknown): value is LogLevel {
  return (
    typeof value === "string" && (LOG_LEVELS as readonly string[]).includes(value)
  );
}

export function isLogSource(value: unknown): value is LogSource {
  return (
    typeof value === "string" &&
    (LOG_SOURCES as readonly string[]).includes(value)
  );
}

/** Message court et sûr à partir d'une erreur inconnue. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erreur inconnue";
}

export type LogInput = {
  level?: LogLevel;
  source: LogSource;
  message: string;
  userId?: string | null;
  ip?: string | null;
  /** Détails libres, sérialisés en JSON. */
  meta?: Record<string, unknown> | null;
};

/**
 * Écrit une entrée dans le journal d'événements de l'instance.
 *
 * **Best-effort** : une erreur d'écriture (table absente, base indisponible…)
 * ne doit jamais faire échouer l'action appelante ; on se contente de la
 * tracer sur la sortie d'erreur.
 */
export async function logEvent(input: LogInput): Promise<void> {
  try {
    await prisma.logEntry.create({
      data: {
        level: input.level ?? "info",
        source: input.source,
        message: input.message.slice(0, 2000),
        userId: input.userId ?? null,
        ip: input.ip ?? null,
        meta: input.meta ? JSON.stringify(input.meta) : null,
      },
    });
  } catch (error) {
    console.error("[log] échec d'écriture", error);
  }

  // Transmission best-effort vers le serveur de logs externe (si configuré).
  forwardToSink({
    level: input.level ?? "info",
    source: input.source,
    message: input.message,
    userId: input.userId ?? null,
    ip: input.ip ?? null,
    meta: input.meta ?? null,
    createdAt: new Date(),
  });
}

/**
 * Durée de rétention du journal en jours (`LOG_RETENTION_DAYS`, défaut 90).
 * `0` désactive la purge (conservation illimitée).
 */
export function logRetentionDays(): number {
  const raw = Number(process.env.LOG_RETENTION_DAYS);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 90;
}

/** Supprime les entrées plus anciennes que la rétention. Renvoie le total purgé. */
export async function purgeLogs(now = new Date()): Promise<number> {
  const days = logRetentionDays();
  if (days === 0) return 0;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  try {
    const result = await prisma.logEntry.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  } catch (error) {
    console.error("[log] échec de purge", error);
    return 0;
  }
}
