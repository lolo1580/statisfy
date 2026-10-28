import "server-only";

import crypto from "node:crypto";
import { prisma } from "./db";
import { logEvent } from "./log";
import { getSetting, setSetting } from "./settings";

/**
 * Webhooks sortants (best-effort) à la fin d'une synchronisation ou d'un import.
 *
 * Trois formats sont reconnus automatiquement à partir de l'URL :
 * - **Discord** (`discord.com/api/webhooks/...`) : corps `{ "content": ... }` ;
 * - **ntfy** (`ntfy.sh`, `ntfy.*`) : corps texte + en-têtes `Title` / `Tags` ;
 * - **générique** (Home Assistant, n8n, script…) : JSON complet.
 *
 * Un secret optionnel signe le corps brut (`X-Statisfy-Signature: sha256=…`),
 * ce qui permet au destinataire de vérifier l'authenticité.
 */

export const SETTING_WEBHOOK_URL = "webhook_url";
export const SETTING_WEBHOOK_SECRET = "webhook_secret";

const TIMEOUT_MS = 5_000;
const MAX_DISCORD_CONTENT = 2_000;

export type WebhookEvent =
  | "test"
  | "sync.completed"
  | "sync.failed"
  | "import.completed"
  | "import.failed";

export type WebhookConfig = { url: string; secret: string };

export type WebhookPayload = {
  event: WebhookEvent;
  title: string;
  message: string;
  timestamp: string;
  user?: { name: string; email: string } | null;
  data?: Record<string, unknown>;
};

/** Valide une URL de webhook (http/https uniquement). */
export function isWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function getWebhookConfig(): Promise<WebhookConfig> {
  const [url, secret] = await Promise.all([
    getSetting(SETTING_WEBHOOK_URL),
    getSetting(SETTING_WEBHOOK_SECRET),
  ]);
  return { url: url ?? "", secret: secret ?? "" };
}

export async function saveWebhookConfig(config: WebhookConfig): Promise<void> {
  await Promise.all([
    setSetting(SETTING_WEBHOOK_URL, config.url),
    setSetting(SETTING_WEBHOOK_SECRET, config.secret),
  ]);
}

/** Signature HMAC-SHA256 du corps brut (`null` si aucun secret). */
export function signWebhook(secret: string, body: string): string | null {
  if (!secret) return null;
  return `sha256=${crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("hex")}`;
}

function isDiscord(url: URL): boolean {
  return (
    url.hostname === "discord.com" ||
    url.hostname.endsWith(".discord.com") ||
    url.hostname === "discordapp.com" ||
    url.hostname.endsWith(".discordapp.com")
  );
}

function isNtfy(url: URL): boolean {
  return url.hostname === "ntfy.sh" || url.hostname.startsWith("ntfy.");
}

/**
 * Construit le corps et les en-têtes selon le service ciblé (fonction pure,
 * testable sans réseau).
 */
export function buildWebhookRequest(
  rawUrl: string,
  payload: WebhookPayload,
  secret = "",
): { body: string; headers: Record<string, string> } {
  const url = new URL(rawUrl);

  let body: string;
  const headers: Record<string, string> = {
    "User-Agent": "Statisfy-Webhook/1.0",
    "X-Statisfy-Event": payload.event,
    "X-Statisfy-Timestamp": payload.timestamp,
  };

  if (isDiscord(url)) {
    body = JSON.stringify({
      content: payload.message.slice(0, MAX_DISCORD_CONTENT),
    });
    headers["Content-Type"] = "application/json";
  } else if (isNtfy(url)) {
    body = payload.message;
    headers["Content-Type"] = "text/plain; charset=utf-8";
    headers.Title = payload.title;
    headers.Tags = payload.event.startsWith("sync")
      ? "arrows_counterclockwise"
      : "inbox_tray";
  } else {
    body = JSON.stringify(payload);
    headers["Content-Type"] = "application/json";
  }

  const hmac = signWebhook(secret, body);
  if (hmac) headers["X-Statisfy-Signature"] = hmac;

  return { body, headers };
}

/** Envoie un événement au webhook configuré. Ne lève jamais : renvoie `false`. */
export async function sendWebhook(
  event: WebhookEvent,
  input: {
    title: string;
    message: string;
    userId?: string | null;
    data?: Record<string, unknown>;
  },
): Promise<boolean> {
  try {
    const config = await getWebhookConfig();
    if (!config.url) return false;

    const user = input.userId
      ? await prisma.user.findUnique({
          where: { id: input.userId },
          select: { name: true, email: true },
        })
      : null;

    const payload: WebhookPayload = {
      event,
      title: input.title,
      message: input.message,
      timestamp: new Date().toISOString(),
      user,
      data: input.data,
    };

    const { body, headers } = buildWebhookRequest(
      config.url,
      payload,
      config.secret,
    );
    const response = await fetch(config.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    await logEvent({
      level: "warn",
      source: "system",
      message: "Échec d'envoi du webhook",
      userId: input.userId ?? null,
      meta: { event, error: message },
    }).catch(() => undefined);
    return false;
  }
}
