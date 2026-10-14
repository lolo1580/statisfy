"use server";

import { revalidatePath } from "next/cache";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getAdminUser } from "../auth/dal";
import { restoreDatabase, runBackup } from "../backup";
import { logEvent, errorMessage } from "../log";
import { getI18n } from "@/i18n/server";

export type RestoreState =
  | { ok?: boolean; error?: string; message?: string }
  | undefined;

/**
 * Restaure une sauvegarde PostgreSQL (`.dump`) : l'état actuel est remplacé.
 * Réservé aux administrateurs. Un dump de sécurité de l'état courant est créé
 * avant l'opération.
 */
export async function restoreBackup(
  _state: RestoreState,
  formData: FormData,
): Promise<RestoreState> {
  const { t } = await getI18n();
  const admin = await getAdminUser();
  if (!admin) return { error: t("err.forbidden") };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: t("err.selectFile") };
  }

  const tmp = path.join(os.tmpdir(), `statisfy-restore-${Date.now()}.dump`);
  try {
    fs.writeFileSync(tmp, Buffer.from(await file.arrayBuffer()), {
      mode: 0o600,
    });
    // Sauvegarde de sécurité de l'état actuel avant d'écraser (best-effort).
    await runBackup().catch(() => undefined);
    await restoreDatabase(tmp);
    await logEvent({
      level: "warn",
      source: "backup",
      message: "Base de données restaurée",
      userId: admin.id,
    });
    revalidatePath("/admin/instance");
    return { ok: true, message: t("msg.restoreDone") };
  } catch (error) {
    await logEvent({
      level: "error",
      source: "backup",
      message: "Échec de la restauration de la base",
      userId: admin.id,
      meta: { error: errorMessage(error) },
    });
    return { error: t("err.restoreFailed") };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}
