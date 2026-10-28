import "server-only";

import type { SinkEvent } from "./config";
import {
  GELF_TCP_DELIMITER,
  GELF_UDP_MAX,
  OTLP_SEVERITY,
  SYSLOG_SEVERITY,
} from "./config";

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

export function errorText(error: unknown): string {
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
