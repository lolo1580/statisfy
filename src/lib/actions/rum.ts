"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "../auth/dal";
import { getI18n } from "@/i18n/server";
import { encryptJson } from "../crypto";
import { setSetting } from "../settings";
import {
  clampSampleRate,
  getRumSettings,
  invalidateRumConfigCache,
  isRumForcedOffByEnv,
  normalizeOrganization,
  SETTING_RUM_CONFIG,
} from "../rum";
import { parseOpenObserveUrl } from "../rum-origin";
import type {
  RumPersistence,
  RumPrivacyLevel,
  RumSettings,
} from "../rum-types";

export type RumState =
  { ok?: boolean; error?: string; message?: string } | undefined;

const PRIVACY_LEVELS = ["allow", "mask-user-input", "mask"] as const;
const PERSISTENCE_MODES = ["cookie", "local-storage", "memory"] as const;

function text(formData: FormData, name: string, max = 500): string {
  return String(formData.get(name) ?? "")
    .trim()
    .slice(0, max);
}

/**
 * Enregistre la configuration RUM de l'instance (Administration → Instance).
 * Réservé aux administrateurs. Les valeurs d'environnement restent des
 * valeurs de secours tant que rien n'a été enregistré.
 */
export async function saveRumSettings(
  _state: RumState,
  formData: FormData,
): Promise<RumState> {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  if (!user.isAdmin) return { error: t("err.forbidden") };

  const forcedOff = isRumForcedOffByEnv();
  const enabled = formData.get("enabled") === "on" && !forcedOff;
  const url = text(formData, "url");
  const submittedToken = text(formData, "token");
  const existing = await getRumSettings();
  const token = submittedToken || existing.token;
  const org = text(formData, "org", 64) || "default";
  const applicationId = text(formData, "applicationId", 100) || "statisfy";
  const service = text(formData, "service", 100) || "statisfy";
  const env = text(formData, "env", 100) || "production";

  if (enabled && !url) return { error: t("admin.rumUrlRequired") };
  if (enabled && !token) return { error: t("admin.rumTokenRequired") };
  if (url && !parseOpenObserveUrl(url)) {
    return { error: t("admin.rumInvalidUrl") };
  }

  const rawRate = Number(formData.get("sampleRate") ?? "100");
  if (!Number.isFinite(rawRate) || rawRate < 0 || rawRate > 100) {
    return { error: t("admin.rumInvalidRate") };
  }
  const rawReplayRate = Number(formData.get("replaySampleRate") ?? "0");
  if (
    !Number.isFinite(rawReplayRate) ||
    rawReplayRate < 0 ||
    rawReplayRate > 100
  ) {
    return { error: t("admin.rumInvalidReplayRate") };
  }

  const rawPrivacy = String(formData.get("privacy") ?? "");
  const privacy: RumPrivacyLevel = (
    PRIVACY_LEVELS as readonly string[]
  ).includes(rawPrivacy)
    ? (rawPrivacy as RumPrivacyLevel)
    : "mask-user-input";
  const rawPersistence = String(formData.get("persistence") ?? "");
  const persistence: RumPersistence = (
    PERSISTENCE_MODES as readonly string[]
  ).includes(rawPersistence)
    ? (rawPersistence as RumPersistence)
    : "memory";

  const settings: RumSettings = {
    enabled,
    url,
    org,
    token,
    applicationId,
    service,
    env,
    sampleRate: clampSampleRate(rawRate),
    privacy,
    persistence,
    trackResources: formData.get("trackResources") === "on",
    trackLongTasks: formData.get("trackLongTasks") === "on",
    trackUserInteractions: formData.get("trackInteractions") === "on",
    logsEnabled: formData.get("logsEnabled") === "on",
    forwardErrorsToLogs: formData.get("forwardErrorsToLogs") === "on",
    sessionReplaySampleRate: clampSampleRate(rawReplayRate),
    startSessionReplay: formData.get("startReplay") === "on",
  };

  await setSetting(SETTING_RUM_CONFIG, encryptJson(settings));
  invalidateRumConfigCache();
  revalidatePath("/admin/instance");
  return { ok: true, message: t("admin.rumSaved") };
}

/**
 * Teste la connexion OpenObserve avec les valeurs du formulaire (sans les
 * enregistrer). Envoie un petit événement de test et remonte le statut HTTP.
 */
export async function testRumConnection(
  _state: RumState,
  formData: FormData,
): Promise<RumState> {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  if (!user.isAdmin) return { error: t("err.forbidden") };

  const existing = await getRumSettings();
  const url = text(formData, "url") || existing.url;
  const token = text(formData, "token") || existing.token;
  const org = normalizeOrganization(text(formData, "org", 64) || existing.org);
  if (!url) return { error: t("admin.rumUrlRequired") };
  if (!token) return { error: t("admin.rumTokenRequired") };
  const parsed = parseOpenObserveUrl(url);
  if (!parsed) return { error: t("admin.rumInvalidUrl") };

  const protocol = parsed.insecureHTTP ? "http" : "https";
  const target = new URL(`${protocol}://${parsed.site}/rum/v1/${org}/rum`);
  target.searchParams.set("o2source", "browser");
  target.searchParams.set("o2-api-key", token);
  target.searchParams.set("o2-evp-origin", "browser");
  target.searchParams.set("o2-request-id", randomUUID());

  try {
    const response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(6_000),
      cache: "no-store",
      redirect: "manual",
    });

    if (response.status === 401 || response.status === 403) {
      return {
        error: t("admin.rumTestAuth", { status: String(response.status) }),
      };
    }
    if (response.status === 404) {
      return { error: t("admin.rumTestNotFound") };
    }
    if (!response.ok) {
      return {
        error: t("admin.rumTestFailed", { status: String(response.status) }),
      };
    }

    // OpenObserve répond 2xx avec un détail par flux ; on vérifie qu'aucune
    // ligne n'a été rejetée.
    try {
      const payload = (await response.json()) as {
        status?: Array<{ failed?: number }>;
      };
      const failed =
        payload.status?.reduce((sum, item) => sum + (item.failed ?? 0), 0) ?? 0;
      if (failed > 0) return { error: t("admin.rumTestRejected") };
    } catch {
      // Corps non JSON : le statut HTTP suffit.
    }

    return { ok: true, message: t("admin.rumTestSuccess") };
  } catch {
    return { error: t("admin.rumTestNetwork") };
  }
}
