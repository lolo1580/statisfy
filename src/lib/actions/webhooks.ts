"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "../auth/dal";
import { getI18n } from "@/i18n/server";
import {
  getWebhookConfig,
  isWebhookUrl,
  saveWebhookConfig,
  sendWebhook,
} from "../webhook";

export type WebhookState =
  { ok?: boolean; error?: string; message?: string } | undefined;

/**
 * Enregistre (ou efface) le webhook de l'instance. Vide = webhook désactivé.
 * Réservé aux administrateurs.
 */
export async function saveWebhook(
  _state: WebhookState,
  formData: FormData,
): Promise<WebhookState> {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  if (!user.isAdmin) return { error: t("err.forbidden") };

  const url = String(formData.get("url") ?? "").trim();
  const secret = String(formData.get("secret") ?? "").trim();
  if (url && !isWebhookUrl(url)) return { error: t("admin.webhookInvalidUrl") };
  if (secret.length > 200) {
    return { error: t("admin.webhookSecretTooLong") };
  }

  await saveWebhookConfig({ url, secret });
  revalidatePath("/admin/instance");
  return {
    ok: true,
    message: url ? t("admin.webhookSaved") : t("admin.webhookCleared"),
  };
}

/** Envoie un événement de test au webhook déjà enregistré. */
export async function testWebhook(
  _state: WebhookState,
  _formData: FormData,
): Promise<WebhookState> {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  if (!user.isAdmin) return { error: t("err.forbidden") };

  const config = await getWebhookConfig();
  if (!config.url) return { error: t("admin.webhookNoUrl") };

  const ok = await sendWebhook("test", {
    title: `${t("admin.webhookTestTitle")}`,
    message: t("admin.webhookTestMessage"),
    userId: user.id,
  });
  return ok
    ? { ok: true, message: t("admin.webhookTestSent") }
    : { error: t("admin.webhookTestFailed") };
}
