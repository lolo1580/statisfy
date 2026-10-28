import "server-only";

import dgram from "node:dgram";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";

/**
 * Envoi best-effort du journal d'événements vers un serveur de logs externe
 * compatible **Graylog** : entrées *GELF HTTP*, *GELF UDP/TCP* ou *Syslog
 * UDP/TCP* (TLS optionnel sur TCP).
 *
 * Le sink est **désactivé par défaut** et configuré uniquement par variables
 * d'environnement (voir `.env.example`). Les envois sont asynchrones et mis en
 * file d'attente (bornée) : ils ne bloquent jamais la requête appelante.
 */

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
const SYSLOG_SEVERITY: Record<SinkLevel, number> = {
  error: 3,
  warn: 4,
  info: 6,
  debug: 7,
};

/** Sévérités OpenTelemetry (OTLP). */
const OTLP_SEVERITY: Record<SinkLevel, number> = {
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
const GELF_UDP_MAX = 8192;

/** Marqueur de fin de message GELF/TCP (octet nul). */
const GELF_TCP_DELIMITER = "\0";

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

function sanitizeField(key: string): string {
  return key.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 64);
}

/** Construit la charge utile GELF 1.1 d'un événement. */
export function gelfPayload(
  event: SinkEvent,
  hostname: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    version: "1.1",
    host: hostname,
    short_message: event.message.slice(0, 120),
    full_message: event.message,
    timestamp: (event.createdAt ?? new Date()).getTime() / 1000,
    level: SYSLOG_SEVERITY[event.level],
    _source: event.source,
  };
  if (event.userId) payload._user_id = event.userId;
  if (event.ip) payload._ip = event.ip;
  if (event.meta) {
    for (const [key, value] of Object.entries(event.meta)) {
      if (value === undefined) continue;
      payload[`_${sanitizeField(key)}`] = value;
    }
  }
  return payload;
}

/**
 * Sérialise une charge GELF pour UDP en respectant la limite de datagramme :
 * en cas de dépassement, les champs additionnels puis le message sont réduits.
 */
export function gelfUdpDatagram(payload: Record<string, unknown>): string {
  let json = JSON.stringify(payload);
  if (Buffer.byteLength(json, "utf8") <= GELF_UDP_MAX) return json;

  const lean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key.startsWith("_") && key !== "_source") continue;
    lean[key] = value;
  }
  json = JSON.stringify(lean);
  if (Buffer.byteLength(json, "utf8") <= GELF_UDP_MAX) return json;

  let message = String(lean.full_message ?? "");
  const probe = { ...lean, full_message: "" };
  const budget = Math.max(
    0,
    GELF_UDP_MAX - Buffer.byteLength(JSON.stringify(probe), "utf8") - 2,
  );
  while (message.length > 0 && Buffer.byteLength(message, "utf8") > budget) {
    message = message.slice(0, Math.floor(message.length * 0.8));
  }
  return JSON.stringify({ ...lean, full_message: message });
}

/** Encadre une charge GELF pour transport TCP (délimiteur octet nul). */
export function gelfTcpFrame(payload: Record<string, unknown>): string {
  return JSON.stringify(payload) + GELF_TCP_DELIMITER;
}

/** Encadre une ligne syslog pour transport TCP (délimiteur saut de ligne). */
export function syslogTcpFrame(line: string): string {
  return line + "\n";
}

/** Construit une ligne syslog RFC 5424. */
export function syslogLine(
  event: SinkEvent,
  config: { hostname: string; facility: number },
): string {
  const priority = config.facility * 8 + SYSLOG_SEVERITY[event.level];
  const timestamp = (event.createdAt ?? new Date()).toISOString();
  const parts = [event.message];
  if (event.userId) parts.push(`user=${event.userId}`);
  if (event.ip) parts.push(`ip=${event.ip}`);
  if (event.meta) {
    try {
      parts.push(`meta=${JSON.stringify(event.meta)}`);
    } catch {
      // meta non sérialisable : ignoré.
    }
  }
  return sanitizeLine(
    `<${priority}>1 ${timestamp} ${config.hostname} statisfy - ${event.source} - ${parts.join(" ")}`,
  );
}

/** Corps JSON générique d'un événement (sink `json-http`). */
export function jsonHttpBody(event: SinkEvent, hostname: string): string {
  return JSON.stringify({
    timestamp: (event.createdAt ?? new Date()).toISOString(),
    level: event.level,
    source: event.source,
    message: event.message,
    host: hostname,
    user_id: event.userId ?? null,
    ip: event.ip ?? null,
    meta: event.meta ?? null,
  });
}

/**
 * Corps de requête pour l'API push de **Grafana Loki** (`POST /loki/api/v1/push`).
 * Le message complet est transporté en ligne JSON ; les labels restent limités
 * (job, level, source, host + labels statiques) pour éviter la haute cardinalité.
 */
export function lokiBody(
  event: SinkEvent,
  config: { hostname: string; labels?: Record<string, string> },
): string {
  const millis = (event.createdAt ?? new Date()).getTime();
  const stream: Record<string, string> = {
    job: "statisfy",
    level: event.level,
    source: event.source,
    host: config.hostname,
    ...(config.labels ?? {}),
  };
  const line = JSON.stringify({
    level: event.level,
    source: event.source,
    message: event.message,
    user_id: event.userId ?? null,
    ip: event.ip ?? null,
    meta: event.meta ?? null,
  });
  return JSON.stringify({
    streams: [
      {
        stream,
        // Horodatage en nanosecondes (chaîne), comme attendu par Loki.
        values: [[`${BigInt(millis)}000000`, line]],
      },
    ],
  });
}

/** Corps NDJSON `_bulk` pour **Elasticsearch / OpenSearch**. */
export function elasticsearchBody(
  event: SinkEvent,
  index: string,
  hostname: string,
): string {
  const action = JSON.stringify({ index: { _index: index } });
  const document = JSON.stringify({
    "@timestamp": (event.createdAt ?? new Date()).toISOString(),
    level: event.level,
    source: event.source,
    message: event.message,
    host: hostname,
    user_id: event.userId ?? null,
    ip: event.ip ?? null,
    meta: event.meta ?? null,
  });
  return `${action}\n${document}\n`;
}

/** Complète une URL de base Loki avec le chemin de l'API push si nécessaire. */
export function lokiUrl(url: string): string {
  const clean = url.replace(/\/+$/, "");
  return /\/push$/.test(clean) ? clean : `${clean}/loki/api/v1/push`;
}

/** Complète une URL de base Elasticsearch/OpenSearch avec `/_bulk` si nécessaire. */
export function elasticsearchUrl(url: string): string {
  const clean = url.replace(/\/+$/, "");
  return /\/_bulk$/.test(clean) ? clean : `${clean}/_bulk`;
}

function otlpAttributes(
  event: SinkEvent,
): Array<{ key: string; value: { stringValue: string } }> {
  const attributes: Array<{ key: string; value: { stringValue: string } }> = [
    { key: "log.source", value: { stringValue: event.source } },
  ];
  if (event.userId) {
    attributes.push({ key: "user.id", value: { stringValue: event.userId } });
  }
  if (event.ip) {
    attributes.push({ key: "client.ip", value: { stringValue: event.ip } });
  }
  if (event.meta) {
    for (const [key, value] of Object.entries(event.meta)) {
      if (value === undefined) continue;
      attributes.push({
        key: `log.meta.${key}`,
        value: {
          stringValue:
            typeof value === "string" ? value : JSON.stringify(value),
        },
      });
    }
  }
  return attributes;
}

/**
 * Corps OTLP/JSON d'un enregistrement de log (endpoint `/v1/logs`), compatible
 * **SigNoz** et tout collecteur OpenTelemetry.
 */
export function otlpBody(event: SinkEvent, hostname: string): string {
  const millis = (event.createdAt ?? new Date()).getTime();
  const nanos = `${BigInt(millis)}000000`;
  return JSON.stringify({
    resourceLogs: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: "statisfy" } },
            { key: "host.name", value: { stringValue: hostname } },
          ],
        },
        scopeLogs: [
          {
            scope: { name: "statisfy" },
            logRecords: [
              {
                timeUnixNano: nanos,
                observedTimeUnixNano: nanos,
                severityNumber: OTLP_SEVERITY[event.level],
                severityText: event.level.toUpperCase(),
                body: { stringValue: event.message },
                attributes: otlpAttributes(event),
              },
            ],
          },
        ],
      },
    ],
  });
}

/** Complète une URL de base OTLP avec `/v1/logs` si nécessaire. */
export function otlpUrl(url: string): string {
  const clean = url.replace(/\/+$/, "");
  return /\/v1\/logs$/.test(clean) ? clean : `${clean}/v1/logs`;
}

/** Ligne NDJSON d'un événement (sink `file`, lisible par un agent Wazuh). */
export function fileLine(event: SinkEvent, hostname: string): string {
  return (
    JSON.stringify({
      "@timestamp": (event.createdAt ?? new Date()).toISOString(),
      level: event.level,
      source: event.source,
      message: event.message,
      host: hostname,
      user_id: event.userId ?? null,
      ip: event.ip ?? null,
      meta: event.meta ?? null,
    }) + "\n"
  );
}

/** Ligne texte simple d'un événement (sink `file`, `LOG_SINK_FILE_FORMAT=raw`). */
export function fileRawLine(event: SinkEvent, _hostname: string): string {
  const timestamp = (event.createdAt ?? new Date()).toISOString();
  const details: string[] = [];
  if (event.userId) details.push(`user=${event.userId}`);
  if (event.ip) details.push(`ip=${event.ip}`);
  const tail = details.length > 0 ? ` (${details.join(", ")})` : "";
  const line = `${timestamp} [${event.level.toUpperCase()}] ${event.source}: ${event.message}${tail}`;
  return `${sanitizeLine(line)}\n`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "erreur inconnue";
}

/**
 * Neutralise les retours ligne et caractères de contrôle pour les sinks
 * **ligne par ligne** (syslog, fichier `raw`) : sans cela, une valeur contrôlée
 * par l'utilisateur (message, e-mail, IP issue d'un en-tête) pourrait forger de
 * fausses entrées de journal (log injection / évasion SIEM).
 */
function sanitizeLine(value: string): string {
  return value.replace(/[\r\n\u0000]+/g, " ");
}

// ---------------------------------------------------------------------------
// Transport UDP
// ---------------------------------------------------------------------------

let udpSocket: dgram.Socket | null = null;

function getUdpSocket(): dgram.Socket {
  if (!udpSocket) {
    udpSocket = dgram.createSocket("udp4");
    // Une erreur de socket ne doit jamais faire planter le process.
    udpSocket.on("error", () => undefined);
    udpSocket.unref();
  }
  return udpSocket;
}

function sendUdp(
  host: string,
  port: number,
  payload: string,
  timeoutMs: number,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const socket = getUdpSocket();
    const buffer = Buffer.from(payload, "utf8");
    let settled = false;
    const finish = (result: { ok: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(
      () => finish({ ok: false, error: "timeout" }),
      timeoutMs,
    );
    socket.send(buffer, port, host, (error) => {
      finish(error ? { ok: false, error: error.message } : { ok: true });
    });
  });
}

// ---------------------------------------------------------------------------
// Transport TCP (avec TLS optionnel)
// ---------------------------------------------------------------------------

type TcpState = {
  key: string;
  socket: net.Socket | null;
  pending: Promise<net.Socket> | null;
};

let tcpState: TcpState | null = null;

function tcpKey(config: SinkConfig): string {
  return [
    config.kind,
    config.host,
    config.port,
    config.tls ? "tls" : "tcp",
    config.rejectUnauthorized ? "verify" : "insecure",
    config.caPath ?? "",
  ].join("|");
}

function destroyTcp(): void {
  if (tcpState?.socket) tcpState.socket.destroy();
  tcpState = null;
}

function readCa(config: SinkConfig): string | undefined {
  if (!config.caPath) return undefined;
  try {
    return fs.readFileSync(config.caPath, "utf8");
  } catch (error) {
    console.error("[log-sink] CA illisible", error);
    return undefined;
  }
}

function connectTcp(config: SinkConfig): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const host = config.host as string;
    const port = config.port as number;
    const ca = config.tls ? readCa(config) : undefined;
    const socket = config.tls
      ? tls.connect({
          host,
          port,
          rejectUnauthorized: config.rejectUnauthorized,
          ...(ca ? { ca } : {}),
        })
      : net.connect({ host, port });

    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(error);
    };
    const succeed = () => {
      if (settled) return;
      settled = true;
      socket.setTimeout(0);
      socket.removeListener("error", fail);
      // Une erreur ultérieure ne doit pas faire planter le process.
      socket.on("error", () => undefined);
      socket.unref();
      resolve(socket);
    };

    socket.once(config.tls ? "secureConnect" : "connect", succeed);
    socket.once("error", fail);
    socket.setTimeout(config.timeoutMs, () => fail(new Error("timeout")));
  });
}

async function getTcpSocket(config: SinkConfig): Promise<net.Socket> {
  const key = tcpKey(config);
  if (tcpState && tcpState.key === key) {
    if (tcpState.socket && !tcpState.socket.destroyed) return tcpState.socket;
    if (tcpState.pending) return tcpState.pending;
  }
  destroyTcp();
  const pending = connectTcp(config);
  tcpState = { key, socket: null, pending };
  try {
    const socket = await pending;
    if (tcpState && tcpState.pending === pending) {
      tcpState.socket = socket;
      tcpState.pending = null;
    }
    return socket;
  } catch (error) {
    if (tcpState && tcpState.pending === pending) destroyTcp();
    throw error;
  }
}

function writeTcp(
  socket: net.Socket,
  data: string,
  timeoutMs: number,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: { ok: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(
      () => finish({ ok: false, error: "timeout" }),
      timeoutMs,
    );
    socket.write(data, (error) => {
      finish(error ? { ok: false, error: error.message } : { ok: true });
    });
  });
}

async function sendTcp(
  config: SinkConfig,
  data: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const socket = await getTcpSocket(config);
    const result = await writeTcp(socket, data, config.timeoutMs);
    if (result.ok) return result;
    destroyTcp();
  } catch {
    destroyTcp();
    // On tente une reconnexion unique ci-dessous.
  }
  try {
    const socket = await getTcpSocket(config);
    return await writeTcp(socket, data, config.timeoutMs);
  } catch (error) {
    destroyTcp();
    return { ok: false, error: errorText(error) };
  }
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function sendHttp(
  url: string,
  body: string,
  timeoutMs: number,
  options: { contentType?: string; headers?: Record<string, string> } = {},
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": options.contentType ?? "application/json",
        ...(options.headers ?? {}),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/**
 * Ajoute une ligne à un fichier de log (sink `file`). Crée le dossier au besoin
 * et effectue une rotation simple (`.1`) quand la taille dépasse le seuil.
 */
async function appendToFile(
  config: SinkConfig,
  line: string,
): Promise<{ ok: boolean; error?: string }> {
  const filePath = config.filePath as string;
  const maxBytes = config.fileMaxBytes ?? 10 * 1024 * 1024;
  try {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    try {
      const stat = await fs.promises.stat(filePath);
      if (stat.size + Buffer.byteLength(line, "utf8") > maxBytes) {
        await fs.promises
          .rename(filePath, `${filePath}.1`)
          .catch(() => undefined);
      }
    } catch {
      // Fichier absent : rien à faire.
    }
    await fs.promises.appendFile(filePath, line, "utf8");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

// ---------------------------------------------------------------------------
// Répartition
// ---------------------------------------------------------------------------

async function deliver(
  config: SinkConfig,
  event: SinkEvent,
): Promise<{ ok: boolean; error?: string }> {
  switch (config.kind) {
    case "gelf-http":
      return sendHttp(
        config.url as string,
        JSON.stringify(gelfPayload(event, config.hostname)),
        config.timeoutMs,
      );
    case "gelf-udp":
      return sendUdp(
        config.host as string,
        config.port as number,
        gelfUdpDatagram(gelfPayload(event, config.hostname)),
        config.timeoutMs,
      );
    case "gelf-tcp":
      return sendTcp(config, gelfTcpFrame(gelfPayload(event, config.hostname)));
    case "syslog-udp":
      return sendUdp(
        config.host as string,
        config.port as number,
        syslogLine(event, config),
        config.timeoutMs,
      );
    case "syslog-tcp":
      return sendTcp(config, syslogTcpFrame(syslogLine(event, config)));
    case "json-http":
      return sendHttp(
        config.url as string,
        jsonHttpBody(event, config.hostname),
        config.timeoutMs,
        { headers: config.headers },
      );
    case "loki":
      return sendHttp(
        lokiUrl(config.url as string),
        lokiBody(event, config),
        config.timeoutMs,
        { headers: config.headers },
      );
    case "elasticsearch":
      return sendHttp(
        elasticsearchUrl(config.url as string),
        elasticsearchBody(
          event,
          config.index ?? "statisfy-logs",
          config.hostname,
        ),
        config.timeoutMs,
        { contentType: "application/x-ndjson", headers: config.headers },
      );
    case "otlp-http":
      return sendHttp(
        otlpUrl(config.url as string),
        otlpBody(event, config.hostname),
        config.timeoutMs,
        { headers: config.headers },
      );
    case "file":
      return appendToFile(
        config,
        config.fileFormat === "raw"
          ? fileRawLine(event, config.hostname)
          : fileLine(event, config.hostname),
      );
  }
}

/** Envoie un événement au sink (utilisé par le bouton de test). */
export async function sendToSink(
  event: SinkEvent,
  config?: SinkConfig | null,
): Promise<SinkResult> {
  const resolved = config === undefined ? getSinkConfig() : config;
  if (!resolved) return { ok: false, kind: null, error: "disabled" };
  const result = await deliver(resolved, event);
  return result.ok
    ? { ok: true, kind: resolved.kind }
    : { ok: false, kind: resolved.kind, error: result.error ?? "erreur" };
}

/** Envoie un événement de test vers le sink configuré. */
export async function sendTestEvent(): Promise<SinkResult> {
  const config = getSinkConfig();
  if (!config) return { ok: false, kind: null, error: "disabled" };
  return sendToSink(
    {
      level: "info",
      source: "system",
      message: "Statisfy — test d'envoi vers le sink de logs",
      createdAt: new Date(),
    },
    config,
  );
}

const MAX_QUEUE = 1000;
const queue: SinkEvent[] = [];
let draining = false;

async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (queue.length > 0) {
      const event = queue.shift();
      if (!event) break;
      const config = getSinkConfig();
      if (!config) continue;
      try {
        await deliver(config, event);
      } catch (error) {
        console.error("[log-sink] échec d'envoi", error);
      }
    }
  } finally {
    draining = false;
  }
}

/**
 * Met un événement en file pour un envoi asynchrone (fire-and-forget).
 * Ne bloque jamais l'appelant ; file bornée (les plus anciens sont abandonnés).
 */
export function forwardToSink(event: SinkEvent): void {
  const config = getSinkConfig();
  if (!config) return;
  if (!isSinkLevelEnabled(event.level, config.minLevel)) return;
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push(event);
  void drain();
}
