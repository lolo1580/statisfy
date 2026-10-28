import "server-only";

import dgram from "node:dgram";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";

import {
  getSinkConfig,
  isSinkLevelEnabled,
  type SinkConfig,
  type SinkEvent,
  type SinkResult,
} from "./config";
import {
  elasticsearchBody,
  elasticsearchUrl,
  errorText,
  fileLine,
  fileRawLine,
  gelfPayload,
  gelfTcpFrame,
  gelfUdpDatagram,
  jsonHttpBody,
  lokiBody,
  lokiUrl,
  otlpBody,
  otlpUrl,
  syslogLine,
  syslogTcpFrame,
} from "./format";

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
