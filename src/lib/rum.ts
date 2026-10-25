import "server-only";

import { appVersion } from "./env";
import { decryptJson } from "./crypto";
import { getSetting } from "./settings";
import { parseOpenObserveUrl } from "./rum-origin";
import type {
  OpenObserveRumClientConfig,
  OpenObserveRumServerConfig,
  RumPersistence,
  RumPrivacyLevel,
  RumSettings,
} from "./rum-types";

/**
 * Real User Monitoring via le SDK navigateur OpenObserve.
 *
 * Les réglages sont éditables dans « Administration → Instance » et stockés
 * dans `AppSetting` (`rum_config`). Les variables d'environnement servent de
 * valeurs par défaut (et de secours tant que rien n'a été enregistré).
 *
 * Le SDK envoie ses événements à `/api/rum` (même origine) : le jeton réel ne
 * quitte jamais le serveur, et le CSP reste limité à `'self'`.
 */

export const SETTING_RUM_CONFIG = "rum_config";
const PROXY_PATH = "/api/rum";
const DEFAULT_ORG = "default";
const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;
const PRIVACY_LEVELS = ["allow", "mask-user-input", "mask"] as const;
const PERSISTENCE_MODES = ["cookie", "local-storage", "memory"] as const;

function safeSegment(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && SAFE_SEGMENT.test(trimmed) ? trimmed : fallback;
}

export function normalizeOrganization(value: string | undefined): string {
  return safeSegment(value, DEFAULT_ORG);
}

function safeName(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 100) : fallback;
}

export function clampSampleRate(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(100, Math.max(0, value));
}

function parseSampleRate(value: string | undefined, fallback = 100): number {
  if (value === undefined || value.trim() === "") return fallback;
  return clampSampleRate(Number(value));
}

function parsePrivacy(value: string | undefined): RumPrivacyLevel {
  return (PRIVACY_LEVELS as readonly string[]).includes(value ?? "")
    ? (value as RumPrivacyLevel)
    : "mask-user-input";
}

function parsePersistence(value: string | undefined): RumPersistence {
  return (PERSISTENCE_MODES as readonly string[]).includes(value ?? "")
    ? (value as RumPersistence)
    : "memory";
}

/** `OPENOBSERVE_RUM_ENABLED=false` (ou l'ancien `RUM_ENABLED=false`) coupe tout. */
export function isRumForcedOffByEnv(): boolean {
  return (
    process.env.OPENOBSERVE_RUM_ENABLED === "false" ||
    process.env.RUM_ENABLED === "false"
  );
}

function envSettings(): RumSettings {
  return {
    enabled: !isRumForcedOffByEnv(),
    url: process.env.OPENOBSERVE_URL?.trim() ?? "",
    org: process.env.OPENOBSERVE_ORG?.trim() || DEFAULT_ORG,
    token: process.env.OPENOBSERVE_RUM_TOKEN?.trim() ?? "",
    applicationId:
      process.env.OPENOBSERVE_RUM_APPLICATION_ID?.trim() || "statisfy",
    service: process.env.OPENOBSERVE_RUM_SERVICE?.trim() || "statisfy",
    env:
      process.env.OPENOBSERVE_RUM_ENV?.trim() ||
      process.env.RUM_ENV?.trim() ||
      process.env.NODE_ENV ||
      "production",
    sampleRate: parseSampleRate(process.env.OPENOBSERVE_RUM_SAMPLE_RATE),
    privacy: parsePrivacy(process.env.OPENOBSERVE_RUM_PRIVACY),
    persistence: parsePersistence(process.env.OPENOBSERVE_RUM_PERSISTENCE),
    trackResources: process.env.OPENOBSERVE_RUM_TRACK_RESOURCES === "true",
    trackLongTasks: process.env.OPENOBSERVE_RUM_TRACK_LONG_TASKS === "true",
    trackUserInteractions:
      process.env.OPENOBSERVE_RUM_TRACK_INTERACTIONS === "true",
    logsEnabled: process.env.OPENOBSERVE_RUM_LOGS !== "false",
    forwardErrorsToLogs:
      process.env.OPENOBSERVE_RUM_FORWARD_ERRORS !== "false",
    sessionReplaySampleRate: parseSampleRate(
      process.env.OPENOBSERVE_RUM_REPLAY_SAMPLE_RATE,
      0,
    ),
    startSessionReplay: process.env.OPENOBSERVE_RUM_START_REPLAY === "true",
  };
}

/** Fusion défensive d'un JSON stocké avec les valeurs d'environnement. */
function mergeSettings(
  base: RumSettings,
  stored: unknown,
): RumSettings {
  if (!stored || typeof stored !== "object") return base;
  const value = stored as Record<string, unknown>;
  const str = (key: keyof RumSettings, fallback: string): string =>
    typeof value[key] === "string" ? (value[key] as string) : fallback;
  const bool = (key: keyof RumSettings, fallback: boolean): boolean =>
    typeof value[key] === "boolean" ? (value[key] as boolean) : fallback;

  return {
    enabled: bool("enabled", base.enabled),
    url: str("url", base.url),
    org: str("org", base.org),
    token: str("token", base.token),
    applicationId: str("applicationId", base.applicationId),
    service: str("service", base.service),
    env: str("env", base.env),
    sampleRate:
      typeof value.sampleRate === "number"
        ? clampSampleRate(value.sampleRate)
        : base.sampleRate,
    privacy: (PRIVACY_LEVELS as readonly string[]).includes(
      String(value.privacy ?? ""),
    )
      ? (value.privacy as RumPrivacyLevel)
      : base.privacy,
    persistence: (PERSISTENCE_MODES as readonly string[]).includes(
      String(value.persistence ?? ""),
    )
      ? (value.persistence as RumPersistence)
      : base.persistence,
    trackResources: bool("trackResources", base.trackResources),
    trackLongTasks: bool("trackLongTasks", base.trackLongTasks),
    trackUserInteractions: bool(
      "trackUserInteractions",
      base.trackUserInteractions,
    ),
    logsEnabled: bool("logsEnabled", base.logsEnabled),
    forwardErrorsToLogs: bool(
      "forwardErrorsToLogs",
      base.forwardErrorsToLogs,
    ),
    sessionReplaySampleRate:
      typeof value.sessionReplaySampleRate === "number"
        ? clampSampleRate(value.sessionReplaySampleRate)
        : base.sessionReplaySampleRate,
    startSessionReplay: bool(
      "startSessionReplay",
      base.startSessionReplay,
    ),
  };
}

/** Réglages effectifs (base : env, surchargés par la configuration admin). */
export async function getRumSettings(): Promise<RumSettings> {
  const base = envSettings();
  const raw = await getSetting(SETTING_RUM_CONFIG);
  if (!raw) return base;

  let parsed: unknown;
  try {
    // Le jeton RUM est chiffré depuis la version courante ; les anciennes
    // valeurs JSON en clair restent lisibles.
    parsed = raw.startsWith("v1.")
      ? decryptJson<unknown>(raw)
      : JSON.parse(raw);
  } catch {
    return base;
  }
  return mergeSettings(base, parsed);
}

let cachedConfig: {
  value: OpenObserveRumServerConfig | null;
  expiresAt: number;
} | null = null;
const CONFIG_CACHE_TTL_MS = 30_000;

/** Invalide le cache après une modification depuis l'administration. */
export function invalidateRumConfigCache(): void {
  cachedConfig = null;
}

/** Configuration complète côté serveur, ou `null` si désactivé/incomplet. */
export async function getRumConfig(): Promise<OpenObserveRumServerConfig | null> {
  const now = Date.now();
  if (cachedConfig && cachedConfig.expiresAt > now) {
    return cachedConfig.value;
  }
  const value = await loadRumConfig();
  cachedConfig = { value, expiresAt: now + CONFIG_CACHE_TTL_MS };
  return value;
}

async function loadRumConfig(): Promise<OpenObserveRumServerConfig | null> {
  if (isRumForcedOffByEnv()) return null;

  const settings = await getRumSettings();
  if (!settings.enabled || !settings.token.trim()) return null;

  const parsedUrl = parseOpenObserveUrl(settings.url);
  if (!parsedUrl) return null;

  const protocol = parsedUrl.insecureHTTP ? "http" : "https";
  return {
    applicationId: safeName(settings.applicationId, "statisfy"),
    clientToken: settings.token.trim(),
    site: parsedUrl.site,
    organizationIdentifier: normalizeOrganization(settings.org),
    service: safeName(settings.service, "statisfy"),
    env: safeName(settings.env, "production"),
    version: appVersion,
    sessionSampleRate: clampSampleRate(settings.sampleRate),
    defaultPrivacyLevel: settings.privacy,
    sessionPersistence: settings.persistence,
    trackResources: settings.trackResources,
    trackLongTasks: settings.trackLongTasks,
    trackUserInteractions: settings.trackUserInteractions,
    logsEnabled: settings.logsEnabled,
    forwardErrorsToLogs: settings.forwardErrorsToLogs,
    sessionReplaySampleRate: clampSampleRate(
      settings.sessionReplaySampleRate,
    ),
    startSessionReplay: settings.startSessionReplay,
    insecureHTTP: parsedUrl.insecureHTTP,
    baseUrl: `${protocol}://${parsedUrl.site}`,
    proxyPath: PROXY_PATH,
  };
}

export function toClientRumConfig(
  config: OpenObserveRumServerConfig,
): OpenObserveRumClientConfig {
  return {
    applicationId: config.applicationId,
    clientToken: "proxy",
    site: config.site,
    organizationIdentifier: config.organizationIdentifier,
    service: config.service,
    env: config.env,
    version: config.version,
    sessionSampleRate: config.sessionSampleRate,
    defaultPrivacyLevel: config.defaultPrivacyLevel,
    sessionPersistence: config.sessionPersistence,
    trackResources: config.trackResources,
    trackLongTasks: config.trackLongTasks,
    trackUserInteractions: config.trackUserInteractions,
    logsEnabled: config.logsEnabled,
    forwardErrorsToLogs: config.forwardErrorsToLogs,
    sessionReplaySampleRate: config.sessionReplaySampleRate,
    startSessionReplay: config.startSessionReplay,
    insecureHTTP: config.insecureHTTP,
    proxy: config.proxyPath,
  };
}

export * from "./rum-status";
