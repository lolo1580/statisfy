import "server-only";

export type SinkLevel = "debug" | "info" | "warn" | "error";

export const SINK_LEVELS: readonly SinkLevel[] = [
  "debug",
  "info",
  "warn",
  "error",
];

export type SinkEvent = {
  level: SinkLevel;
  source: string;
  message: string;
  userId?: string | null;
  ip?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt?: Date;
};

export type SinkKind =
  | "gelf-http"
  | "gelf-udp"
  | "gelf-tcp"
  | "syslog-udp"
  | "syslog-tcp"
  | "json-http"
  | "loki"
  | "elasticsearch"
  | "otlp-http"
  | "file";

export type SinkConfig = {
  kind: SinkKind;
  minLevel: SinkLevel;
  hostname: string;
  /** Pour les transports HTTP (GELF, JSON, Loki, Elasticsearch). */
  url?: string;
  /** En-têtes HTTP additionnels. */
  headers?: Record<string, string>;
  /** Index Elasticsearch/OpenSearch. */
  index?: string;
  /** Labels Loki supplémentaires. */
  labels?: Record<string, string>;
  /** Fichier de sortie (sink `file`). */
  filePath?: string;
  /** Taille maximale avant rotation (sink `file`). */
  fileMaxBytes?: number;
  /** Format de ligne du sink `file` : `json` (NDJSON, défaut) ou `raw`. */
  fileFormat?: "json" | "raw";
  /** Pour les transports réseau. */
  host?: string;
  port?: number;
  /** TLS (transports TCP uniquement). */
  tls?: boolean;
  rejectUnauthorized?: boolean;
  /** Chemin d'un bundle CA (PEM) pour une autorité privée. */
  caPath?: string;
  /** Facility syslog (0-23), défaut 1 (`user`). */
  facility: number;
  timeoutMs: number;
};

export type SinkResult =
  | { ok: true; kind: SinkKind }
  | { ok: false; kind: SinkKind | null; error: string };

const LEVEL_WEIGHT: Record<SinkLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Sévérités syslog (RFC 5424) : plus petit = plus grave. */
export const SYSLOG_SEVERITY: Record<SinkLevel, number> = {
  error: 3,
  warn: 4,
  info: 6,
  debug: 7,
};

/** Sévérités OpenTelemetry (OTLP). */
export const OTLP_SEVERITY: Record<SinkLevel, number> = {
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
};

const FACILITIES: Record<string, number> = {
  kern: 0,
  user: 1,
  mail: 2,
  daemon: 3,
  auth: 4,
  syslog: 5,
  lpr: 6,
  news: 7,
  uucp: 8,
  cron: 9,
  authpriv: 10,
  ftp: 11,
  local0: 16,
  local1: 17,
  local2: 18,
  local3: 19,
  local4: 20,
  local5: 21,
  local6: 22,
  local7: 23,
};

/** Taille maximale d'un datagramme GELF/UDP (chunking non implémenté). */
export const GELF_UDP_MAX = 8192;

/** Marqueur de fin de message GELF/TCP (octet nul). */
export const GELF_TCP_DELIMITER = "\0";

export function isSinkLevel(value: unknown): value is SinkLevel {
  return (
    typeof value === "string" &&
    (SINK_LEVELS as readonly string[]).includes(value)
  );
}

function intOr(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function boolOr(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || String(value).trim() === "") {
    return fallback;
  }
  const text = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(text)) return true;
  if (["0", "false", "no", "off"].includes(text)) return false;
  return fallback;
}

/** Analyse une variable d'environnement JSON `{ "clé": "valeur" }` (valeurs texte). */
export function parseStringMap(
  value: unknown,
): Record<string, string> | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    const out: Record<string, string> = {};
    for (const [key, entry] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (typeof entry === "string") out[key] = entry;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  } catch {
    return undefined;
  }
}

const TCP_KINDS: readonly string[] = ["gelf-tcp", "syslog-tcp"];

/** Analyse la configuration du sink à partir de l'environnement. */
export function parseSinkConfig(
  env: Record<string, string | undefined>,
): SinkConfig | null {
  let kind = (env.LOG_SINK ?? "").trim().toLowerCase();
  if (!kind || kind === "none" || kind === "off" || kind === "false")
    return null;

  // Alias explicites avec TLS forcé.
  let forceTls = false;
  if (kind === "gelf-tcp-tls") {
    kind = "gelf-tcp";
    forceTls = true;
  } else if (kind === "syslog-tcp-tls") {
    kind = "syslog-tcp";
    forceTls = true;
  }

  const valid = [
    "gelf-http",
    "gelf-udp",
    "gelf-tcp",
    "syslog-udp",
    "syslog-tcp",
    "json-http",
    "loki",
    "elasticsearch",
    "otlp-http",
    "file",
  ];
  if (!valid.includes(kind)) return null;

  const minLevel = isSinkLevel(env.LOG_SINK_MIN_LEVEL)
    ? env.LOG_SINK_MIN_LEVEL
    : "info";
  const hostname =
    (env.LOG_SINK_HOSTNAME ?? "").trim() ||
    (env.NEXT_PUBLIC_APP_NAME ?? "").trim() ||
    "Statisfy";
  const timeoutMs = intOr(env.LOG_SINK_TIMEOUT_MS, 2000, 200, 10000);
  const facility =
    FACILITIES[(env.LOG_SINK_FACILITY ?? "user").trim().toLowerCase()] ?? 1;

  const URL_KINDS = [
    "gelf-http",
    "json-http",
    "loki",
    "elasticsearch",
    "otlp-http",
  ];
  if (URL_KINDS.includes(kind)) {
    const url = (env.LOG_SINK_URL ?? "").trim();
    if (!url) return null;
    const config: SinkConfig = {
      kind: kind as SinkKind,
      minLevel,
      hostname,
      url,
      facility,
      timeoutMs,
    };
    if (kind !== "gelf-http") {
      config.headers = parseStringMap(env.LOG_SINK_HEADERS);
    }
    if (kind === "elasticsearch") {
      config.index = (env.LOG_SINK_INDEX ?? "").trim() || "statisfy-logs";
    }
    if (kind === "loki") {
      config.labels = parseStringMap(env.LOG_SINK_LABELS);
    }
    return config;
  }

  if (kind === "file") {
    const filePath = (env.LOG_SINK_FILE ?? "").trim();
    if (!filePath) return null;
    const maxMb = intOr(env.LOG_SINK_FILE_MAX_MB, 10, 1, 1024);
    const fileFormat =
      (env.LOG_SINK_FILE_FORMAT ?? "").trim().toLowerCase() === "raw"
        ? "raw"
        : "json";
    return {
      kind: "file",
      minLevel,
      hostname,
      facility,
      timeoutMs,
      filePath,
      fileMaxBytes: maxMb * 1024 * 1024,
      fileFormat,
    };
  }

  const host = (env.LOG_SINK_HOST ?? "").trim();
  if (!host) return null;
  const isGelf = kind.startsWith("gelf");
  const isTcp = TCP_KINDS.includes(kind);
  const defaultPort = isGelf ? 12201 : 514;
  const port = intOr(env.LOG_SINK_PORT, defaultPort, 1, 65535);

  if (!isTcp) {
    return {
      kind: kind as SinkKind,
      minLevel,
      hostname,
      host,
      port,
      facility,
      timeoutMs,
    };
  }

  const useTls = forceTls || boolOr(env.LOG_SINK_TLS, false);
  return {
    kind: kind as SinkKind,
    minLevel,
    hostname,
    host,
    port,
    tls: useTls,
    rejectUnauthorized: boolOr(env.LOG_SINK_TLS_REJECT_UNAUTHORIZED, true),
    caPath: (env.LOG_SINK_TLS_CA ?? "").trim() || undefined,
    facility,
    timeoutMs,
  };
}

/** Configuration courante (lue à chaque appel pour refléter l'environnement). */
export function getSinkConfig(): SinkConfig | null {
  return parseSinkConfig(process.env);
}

export function isSinkEnabled(): boolean {
  return getSinkConfig() !== null;
}

export function activeSinkKind(): SinkKind | null {
  return getSinkConfig()?.kind ?? null;
}

/** Faut-il transmettre un événement de ce niveau (selon le seuil configuré) ? */
export function isSinkLevelEnabled(
  level: SinkLevel,
  minLevel: SinkLevel,
): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[minLevel];
}
