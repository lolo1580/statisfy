import "server-only";

import { getSetting, setSetting } from "./settings";

export type RumStatusTrack = "rum" | "logs" | "replay";

export type RumStatus = {
  lastEventAt?: string;
  lastTrack?: RumStatusTrack;
  lastErrorAt?: string;
  lastErrorStatus?: number | null;
  lastError?: string | null;
};

export const SETTING_RUM_STATUS = "rum_status";
const STATUS_WRITE_INTERVAL_MS = 30_000;
const STATUS_ERROR_WRITE_INTERVAL_MS = 10_000;

let cachedStatus: RumStatus | null = null;
let lastStatusWriteAt = 0;

/** Réinitialise le cache d'état (tests / diagnostic). */
export function resetRumStatusCache(): void {
  cachedStatus = null;
  lastStatusWriteAt = 0;
}

function parseStatus(raw: string | null): RumStatus {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return {
      lastEventAt:
        typeof value.lastEventAt === "string" ? value.lastEventAt : undefined,
      lastTrack:
        value.lastTrack === "rum" ||
        value.lastTrack === "logs" ||
        value.lastTrack === "replay"
          ? value.lastTrack
          : undefined,
      lastErrorAt:
        typeof value.lastErrorAt === "string" ? value.lastErrorAt : undefined,
      lastErrorStatus:
        typeof value.lastErrorStatus === "number"
          ? value.lastErrorStatus
          : null,
      lastError:
        typeof value.lastError === "string" ? value.lastError : null,
    };
  } catch {
    return {};
  }
}

/** État du dernier événement/erreur relayé (mémoire + base, throttlé). */
export async function getRumStatus(): Promise<RumStatus> {
  if (cachedStatus) return cachedStatus;
  try {
    cachedStatus = parseStatus(await getSetting(SETTING_RUM_STATUS));
  } catch {
    cachedStatus = {};
  }
  return cachedStatus;
}

/** Met à jour l'état après un relais (best-effort, écriture throttlée). */
export async function recordRumForward(
  track: RumStatusTrack,
  result: { ok: boolean; status?: number | null; error?: string | null },
  now: Date = new Date(),
): Promise<void> {
  const current = await getRumStatus();
  const next: RumStatus = { ...current };
  if (result.ok) {
    next.lastEventAt = now.toISOString();
    next.lastTrack = track;
  } else {
    next.lastErrorAt = now.toISOString();
    next.lastErrorStatus = result.status ?? null;
    next.lastError = result.error ?? null;
  }
  cachedStatus = next;

  const interval = result.ok
    ? STATUS_WRITE_INTERVAL_MS
    : STATUS_ERROR_WRITE_INTERVAL_MS;
  if (now.getTime() - lastStatusWriteAt < interval) return;
  lastStatusWriteAt = now.getTime();
  try {
    await setSetting(SETTING_RUM_STATUS, JSON.stringify(next));
  } catch {
    // Best-effort : l'état en mémoire reste disponible pour l'admin.
  }
}

/** Configuration transmise au navigateur : jeton réel retiré, proxy same-origin. */
