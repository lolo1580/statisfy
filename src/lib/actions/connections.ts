"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { getAdminUser, getCurrentUser } from "../auth/dal";
import { runImport, runPlaysIngest, runSyncForConnection } from "../sync/engine";
import { enrichMissingImages } from "../sources/enrich";
import {
  buildYourSpotifyData,
  mapYourSpotifyData,
} from "../sources/your-spotify";
import { SETTING_ALLOW_REGISTRATION, setSetting } from "../settings";
import { logEvent, errorMessage } from "../log";
import { getI18n } from "@/i18n/server";

export type SettingsState =
  | {
      ok?: boolean
      error?: string
      message?: string
    }
  | undefined;

export async function deleteConnection(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const id = String(formData.get("connectionId") ?? "");
  if (id) {
    await prisma.sourceConnection.deleteMany({ where: { id, userId: user.id } });
  }
  revalidatePath("/settings/sources");
}

export async function syncConnection(
  _state: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  const id = String(formData.get("connectionId") ?? "");
  const connection = await prisma.sourceConnection.findFirst({
    where: { id, userId: user.id },
  });
  if (!connection) return { error: t("err.connectionNotFound") };

  try {
    const result = await runSyncForConnection(connection.id);
    revalidatePath("/settings/sources");
    revalidatePath("/dashboard");
    return { ok: true, message: t("msg.syncDone", { count: result.inserted }) };
  } catch (error) {
    console.error("[sync] échec de la synchronisation", error);
    revalidatePath("/settings/sources");
    return { error: t("err.syncFailed") };
  }
}

export async function importHistory(
  _state: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) {
    return { error: t("err.selectFile") };
  }

  const payload: Array<{ name: string; data: Uint8Array }> = [];
  for (const file of files) {
    payload.push({
      name: file.name,
      data: new Uint8Array(await file.arrayBuffer()),
    });
  }

  try {
    const result = await runImport(user.id, payload);
    if (result.total === 0) return { error: t("err.noHistory") };

    // Complète les pochettes manquantes (les imports n'en contiennent pas).
    let enriched = 0;
    try {
      const enrichment = await enrichMissingImages(user.id, { max: 40 });
      enriched = enrichment.artistsUpdated + enrichment.albumsUpdated;
    } catch {
      // L'enrichissement est optionnel : l'import reste valide sans lui.
    }

    revalidatePath("/settings/import");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message:
        t("msg.importDone", {
          inserted: result.inserted,
          total: result.total,
          files: result.files,
        }) + (enriched ? t("msg.importDoneVisuals", { count: enriched }) : ""),
    };
  } catch (error) {
    console.error("[import] échec de l'import", error);
    return { error: t("err.importFailed") };
  }
}

/** Importe un dump MongoDB de *Your Spotify* (BSON/JSON, éventuellement zippé). */
export async function importYourSpotify(
  _state: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length === 0) return { error: t("err.selectFile") };

  try {
    const payload: Array<{ name: string; data: Uint8Array }> = [];
    for (const file of files) {
      payload.push({
        name: file.name,
        data: new Uint8Array(await file.arrayBuffer()),
      });
    }

    const { data, counts } = buildYourSpotifyData(payload);
    if ((counts.infos ?? 0) === 0) return { error: t("ys.err.noInfos") };

    const { plays } = mapYourSpotifyData(data);
    const result = await runPlaysIngest(user.id, plays);

    revalidatePath("/settings/import");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: t("msg.yourspotifyDone", {
        inserted: result.inserted,
        total: result.total,
      }),
    };
  } catch (error) {
    console.error("[import] échec de l'import", error);
    return { error: t("err.importFailed") };
  }
}

/** Complète les pochettes / photos d'artistes manquantes via le catalogue Spotify. */
export async function enrichImages(
  _state: SettingsState,
  _formData: FormData,
): Promise<SettingsState> {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  try {
    const result = await enrichMissingImages(user.id, { max: 80 });
    revalidatePath("/settings/sources");
    revalidatePath("/dashboard");
    revalidatePath("/top");
    revalidatePath("/history");
    return {
      ok: true,
      message: t("msg.enrichDone", {
        albums: result.albumsUpdated,
        albumsChecked: result.albumsChecked,
        artists: result.artistsUpdated,
        artistsChecked: result.artistsChecked,
      }),
    };
  } catch (error) {
    console.error("[enrich] échec de l'enrichissement", error);
    await logEvent({
      level: "error",
      source: "source",
      message: "Échec de l'enrichissement des visuels",
      userId: user.id,
      meta: { error: errorMessage(error) },
    });
    return { error: t("err.enrichFailed") };
  }
}

export async function updateTimezone(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const timezone = String(formData.get("timezone") ?? "").trim();
  if (!timezone) return;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { timezone } });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function setRegistration(formData: FormData): Promise<void> {
  const admin = await getAdminUser();
  if (!admin) return;
  const enabled = String(formData.get("enabled") ?? "") === "true";
  await setSetting(SETTING_ALLOW_REGISTRATION, enabled ? "true" : "false");
  await logEvent({
    level: "info",
    source: "admin",
    message: enabled ? "Inscriptions activées" : "Inscriptions désactivées",
    userId: admin.id,
  });
  revalidatePath("/admin/instance");
}
