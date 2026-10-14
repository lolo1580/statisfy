"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { getAdminUser } from "../auth/dal";
import { logEvent } from "../log";
import { sendTestEvent } from "../log-sink";
import { getI18n } from "@/i18n/server";

/** État renvoyé par le bouton de test du sink de logs. */
export type LogTestState =
  | { ok?: boolean; message?: string; error?: string }
  | undefined;

/** Vide entièrement le journal d'événements (réservé aux administrateurs). */
export async function clearLogs(): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) return;
  await prisma.logEntry.deleteMany({});
  // On conserve une trace de l'opération (le journal n'est donc pas totalement vide).
  await logEvent({
    level: "warn",
    source: "admin",
    message: "Journal vidé",
    userId: admin.id,
  });
  revalidatePath("/admin/logs");
}

/** Envoie un événement de test au serveur de logs configuré (ou signale l'absence de config). */
export async function testLogSink(
  _state: LogTestState,
  _formData: FormData,
): Promise<LogTestState> {
  const { t } = await getI18n();
  const admin = await getAdminUser();
  if (!admin) return { error: t("err.forbidden") };

  const result = await sendTestEvent();
  if (!result.ok) {
    return {
      error:
        result.kind === null
          ? t("admin.logTestDisabled")
          : t("admin.logTestFailed", { error: result.error }),
    };
  }

  await logEvent({
    level: "info",
    source: "admin",
    message: "Test d'envoi du sink de logs",
    userId: admin.id,
    meta: { sink: result.kind },
  });
  return { ok: true, message: t("admin.logTestSent", { sink: result.kind }) };
}
