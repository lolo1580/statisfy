import { describe, expect, it } from "vitest";
import {
  elasticsearchBody,
  elasticsearchUrl,
  fileLine,
  fileRawLine,
  gelfPayload,
  gelfTcpFrame,
  gelfUdpDatagram,
  isSinkLevelEnabled,
  jsonHttpBody,
  lokiBody,
  lokiUrl,
  otlpBody,
  otlpUrl,
  parseSinkConfig,
  syslogLine,
  syslogTcpFrame,
  type SinkEvent,
} from "@/lib/log-sink";

const event: SinkEvent = {
  level: "error",
  source: "admin",
  message: "Échec de synchronisation",
  userId: "user-1",
  ip: "10.0.0.7",
  meta: { target: "abc", "weird key": "x" },
  createdAt: new Date("2026-10-13T12:00:00.000Z"),
};

describe("parseSinkConfig", () => {
  it("est désactivé par défaut et sur les valeurs neutres", () => {
    expect(parseSinkConfig({})).toBeNull();
    expect(parseSinkConfig({ LOG_SINK: "" })).toBeNull();
    expect(parseSinkConfig({ LOG_SINK: "none" })).toBeNull();
    expect(parseSinkConfig({ LOG_SINK: "off" })).toBeNull();
    expect(parseSinkConfig({ LOG_SINK: "kafka" })).toBeNull();
  });

  it("configure GELF HTTP", () => {
    const config = parseSinkConfig({
      LOG_SINK: "gelf-http",
      LOG_SINK_URL: "http://graylog:12201/gelf",
    });
    expect(config?.kind).toBe("gelf-http");
    expect(config?.url).toBe("http://graylog:12201/gelf");
    expect(config?.minLevel).toBe("info");
    expect(config?.hostname).toBe("Statisfy");
  });

  it("refuse GELF HTTP sans URL", () => {
    expect(parseSinkConfig({ LOG_SINK: "gelf-http" })).toBeNull();
  });

  it("configure GELF UDP avec port par défaut", () => {
    const config = parseSinkConfig({ LOG_SINK: "gelf-udp", LOG_SINK_HOST: "graylog" });
    expect(config?.kind).toBe("gelf-udp");
    expect(config?.host).toBe("graylog");
    expect(config?.port).toBe(12201);
  });

  it("configure Syslog UDP avec port et facility", () => {
    const config = parseSinkConfig({
      LOG_SINK: "syslog-udp",
      LOG_SINK_HOST: "graylog",
      LOG_SINK_PORT: "1514",
      LOG_SINK_FACILITY: "local0",
      LOG_SINK_MIN_LEVEL: "warn",
      LOG_SINK_HOSTNAME: "statisfy-prod",
    });
    expect(config?.kind).toBe("syslog-udp");
    expect(config?.port).toBe(1514);
    expect(config?.facility).toBe(16);
    expect(config?.minLevel).toBe("warn");
    expect(config?.hostname).toBe("statisfy-prod");
  });

  it("refuse un hôte manquant pour UDP", () => {
    expect(parseSinkConfig({ LOG_SINK: "gelf-udp" })).toBeNull();
  });

  it("configure GELF TCP sans TLS par défaut", () => {
    const config = parseSinkConfig({ LOG_SINK: "gelf-tcp", LOG_SINK_HOST: "graylog" });
    expect(config?.kind).toBe("gelf-tcp");
    expect(config?.port).toBe(12201);
    expect(config?.tls).toBe(false);
    expect(config?.rejectUnauthorized).toBe(true);
  });

  it("active TLS via LOG_SINK_TLS ou l'alias -tls", () => {
    const flag = parseSinkConfig({
      LOG_SINK: "syslog-tcp",
      LOG_SINK_HOST: "graylog",
      LOG_SINK_TLS: "true",
      LOG_SINK_TLS_REJECT_UNAUTHORIZED: "false",
    });
    expect(flag?.tls).toBe(true);
    expect(flag?.rejectUnauthorized).toBe(false);

    const alias = parseSinkConfig({ LOG_SINK: "gelf-tcp-tls", LOG_SINK_HOST: "h" });
    expect(alias?.kind).toBe("gelf-tcp");
    expect(alias?.tls).toBe(true);
  });
});

describe("encadrement TCP", () => {
  it("termine GELF par un octet nul", () => {
    const frame = gelfTcpFrame({ version: "1.1", short_message: "hi" });
    expect(frame.endsWith("\0")).toBe(true);
    const parsed = JSON.parse(frame.slice(0, -1)) as Record<string, unknown>;
    expect(parsed.short_message).toBe("hi");
  });

  it("termine syslog par un saut de ligne", () => {
    expect(syslogTcpFrame("<14>1 x")).toBe("<14>1 x\n");
  });
});

describe("sinks HTTP génériques", () => {
  it("configure json-http avec en-têtes", () => {
    const config = parseSinkConfig({
      LOG_SINK: "json-http",
      LOG_SINK_URL: "https://logs.example/ingest",
      LOG_SINK_HEADERS: '{"Authorization":"Bearer abc","X-Env":"prod"}',
    });
    expect(config?.kind).toBe("json-http");
    expect(config?.headers).toEqual({
      Authorization: "Bearer abc",
      "X-Env": "prod",
    });
  });

  it("configure Loki avec labels et index ES par défaut", () => {
    const loki = parseSinkConfig({
      LOG_SINK: "loki",
      LOG_SINK_URL: "http://loki:3100",
      LOG_SINK_LABELS: '{"env":"prod"}',
    });
    expect(loki?.kind).toBe("loki");
    expect(loki?.labels).toEqual({ env: "prod" });

    const es = parseSinkConfig({
      LOG_SINK: "elasticsearch",
      LOG_SINK_URL: "http://es:9200",
    });
    expect(es?.kind).toBe("elasticsearch");
    expect(es?.index).toBe("statisfy-logs");
  });

  it("refuse une URL manquante", () => {
    expect(parseSinkConfig({ LOG_SINK: "loki" })).toBeNull();
    expect(parseSinkConfig({ LOG_SINK: "elasticsearch" })).toBeNull();
  });

  it("assainit les en-têtes invalides", () => {
    const config = parseSinkConfig({
      LOG_SINK: "json-http",
      LOG_SINK_URL: "https://x/y",
      LOG_SINK_HEADERS: "not-json",
    });
    expect(config?.headers).toBeUndefined();
  });
});

describe("corps HTTP génériques", () => {
  it("construit un JSON générique", () => {
    const body = JSON.parse(jsonHttpBody(event, "host-1")) as Record<string, unknown>;
    expect(body.level).toBe("error");
    expect(body.source).toBe("admin");
    expect(body.host).toBe("host-1");
    expect(body.user_id).toBe("user-1");
  });

  it("construit un push Loki avec horodatage en nanosecondes", () => {
    const body = JSON.parse(
      lokiBody(event, { hostname: "host-1", labels: { env: "prod" } }),
    ) as {
      streams: Array<{
        stream: Record<string, string>;
        values: Array<[string, string]>;
      }>;
    };
    const [entry] = body.streams;
    expect(entry.stream.job).toBe("statisfy");
    expect(entry.stream.level).toBe("error");
    expect(entry.stream.env).toBe("prod");
    const [nanos, line] = entry.values[0];
    expect(nanos).toBe(`${BigInt(event.createdAt!.getTime())}000000`);
    expect(nanos.length).toBe(19);
    expect((JSON.parse(line) as Record<string, unknown>).message).toBe(
      "Échec de synchronisation",
    );
  });

  it("construit un bulk Elasticsearch NDJSON", () => {
    const body = elasticsearchBody(event, "statisfy-logs", "host-1");
    const lines = body.trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    const action = JSON.parse(lines[0]) as { index: { _index: string } };
    expect(action.index._index).toBe("statisfy-logs");
    const doc = JSON.parse(lines[1]) as Record<string, unknown>;
    expect(doc["@timestamp"]).toBe("2026-10-13T12:00:00.000Z");
    expect(doc.level).toBe("error");
  });

  it("complète les URL de base", () => {
    expect(lokiUrl("http://loki:3100")).toBe("http://loki:3100/loki/api/v1/push");
    expect(lokiUrl("http://loki:3100/loki/api/v1/push")).toBe(
      "http://loki:3100/loki/api/v1/push",
    );
    expect(elasticsearchUrl("http://es:9200")).toBe("http://es:9200/_bulk");
    expect(elasticsearchUrl("http://es:9200/_bulk")).toBe("http://es:9200/_bulk");
  });
});

describe("OTLP (SigNoz / OpenTelemetry)", () => {
  it("configure otlp-http", () => {
    const config = parseSinkConfig({
      LOG_SINK: "otlp-http",
      LOG_SINK_URL: "http://signoz-otel-collector:4318",
      LOG_SINK_HEADERS: '{"signoz-ingestion-key":"abc"}',
    });
    expect(config?.kind).toBe("otlp-http");
    expect(config?.headers).toEqual({ "signoz-ingestion-key": "abc" });
  });

  it("refuse une URL manquante", () => {
    expect(parseSinkConfig({ LOG_SINK: "otlp-http" })).toBeNull();
  });

  it("construit un enregistrement de log OTLP/JSON", () => {
    const body = JSON.parse(otlpBody(event, "host-1")) as {
      resourceLogs: Array<{
        resource: { attributes: Array<{ key: string; value: { stringValue: string } }> };
        scopeLogs: Array<{
          logRecords: Array<{
            timeUnixNano: string;
            severityNumber: number;
            severityText: string;
            body: { stringValue: string };
            attributes: Array<{ key: string }>;
          }>;
        }>;
      }>;
    };
    const resource = body.resourceLogs[0];
    expect(resource.resource.attributes).toContainEqual({
      key: "service.name",
      value: { stringValue: "statisfy" },
    });
    const record = resource.scopeLogs[0].logRecords[0];
    expect(record.severityNumber).toBe(17); // error
    expect(record.severityText).toBe("ERROR");
    expect(record.timeUnixNano).toBe(`${BigInt(event.createdAt!.getTime())}000000`);
    expect(record.timeUnixNano.length).toBe(19);
    expect(record.body.stringValue).toBe("Échec de synchronisation");
    const keys = record.attributes.map((a) => a.key);
    expect(keys).toContain("log.source");
    expect(keys).toContain("user.id");
    expect(keys).toContain("client.ip");
  });

  it("complète l'URL OTLP avec /v1/logs", () => {
    expect(otlpUrl("http://collector:4318")).toBe("http://collector:4318/v1/logs");
    expect(otlpUrl("http://collector:4318/v1/logs")).toBe(
      "http://collector:4318/v1/logs",
    );
  });
});

describe("sink fichier (Wazuh)", () => {
  it("configure le sink fichier avec rotation", () => {
    const config = parseSinkConfig({
      LOG_SINK: "file",
      LOG_SINK_FILE: "/var/log/statisfy/events.ndjson",
      LOG_SINK_FILE_MAX_MB: "5",
    });
    expect(config?.kind).toBe("file");
    expect(config?.filePath).toBe("/var/log/statisfy/events.ndjson");
    expect(config?.fileMaxBytes).toBe(5 * 1024 * 1024);
  });

  it("refuse un chemin manquant", () => {
    expect(parseSinkConfig({ LOG_SINK: "file" })).toBeNull();
  });

  it("produit une ligne NDJSON exploitable", () => {
    const line = fileLine(event, "host-1");
    expect(line.endsWith("\n")).toBe(true);
    const parsed = JSON.parse(line.trimEnd()) as Record<string, unknown>;
    expect(parsed["@timestamp"]).toBe("2026-10-13T12:00:00.000Z");
    expect(parsed.level).toBe("error");
    expect(parsed.host).toBe("host-1");
  });

  it("accepte le format de ligne raw", () => {
    const config = parseSinkConfig({
      LOG_SINK: "file",
      LOG_SINK_FILE: "/tmp/x.ndjson",
      LOG_SINK_FILE_FORMAT: "raw",
    });
    expect(config?.fileFormat).toBe("raw");

    const line = fileRawLine(event, "host-1");
    expect(line).toContain("[ERROR] admin: Échec de synchronisation");
    expect(line).toContain("user=user-1");
    expect(line.endsWith("\n")).toBe(true);
  });

  it("neutralise les retours ligne (anti log injection)", () => {
    const evil: SinkEvent = {
      level: "warn",
      source: "auth",
      message: "ligne1\nfausse entrée SIEM",
      userId: "u1",
      ip: "1.2.3.4\r\nfaux",
    };

    const syslog = syslogLine(evil, { hostname: "h", facility: 1 });
    expect(syslog).not.toContain("\n");
    expect(syslog).not.toContain("\r");
    expect(syslog).toContain("ligne1 fausse entrée SIEM");

    const raw = fileRawLine(evil, "h");
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw.slice(0, -1)).not.toContain("\n");
    expect(raw).toContain("ligne1 fausse entrée SIEM");
  });
});

describe("isSinkLevelEnabled", () => {
  it("respecte l'ordre des niveaux", () => {
    expect(isSinkLevelEnabled("error", "info")).toBe(true);
    expect(isSinkLevelEnabled("info", "info")).toBe(true);
    expect(isSinkLevelEnabled("debug", "info")).toBe(false);
    expect(isSinkLevelEnabled("info", "warn")).toBe(false);
    expect(isSinkLevelEnabled("warn", "warn")).toBe(true);
  });
});

describe("gelfPayload", () => {
  it("produit une charge GELF 1.1 complète", () => {
    const payload = gelfPayload(event, "host-1");
    expect(payload.version).toBe("1.1");
    expect(payload.host).toBe("host-1");
    expect(payload.short_message).toBe("Échec de synchronisation");
    expect(payload.level).toBe(3); // error
    expect(payload.timestamp).toBe(
      new Date("2026-10-13T12:00:00.000Z").getTime() / 1000,
    );
    expect(payload._source).toBe("admin");
    expect(payload._user_id).toBe("user-1");
    expect(payload._ip).toBe("10.0.0.7");
    expect(payload._target).toBe("abc");
    expect(payload._weird_key).toBe("x"); // clé assainie
  });
});

describe("gelfUdpDatagram", () => {
  it("laisse les petites charges telles quelles", () => {
    const json = gelfUdpDatagram(gelfPayload(event, "host"));
    expect(JSON.parse(json).full_message).toBe("Échec de synchronisation");
  });

  it("réduit la charge sous la limite UDP de 8192 octets", () => {
    const big: SinkEvent = {
      level: "error",
      source: "sync",
      message: "x".repeat(4000),
      meta: { stack: "y".repeat(12000) },
    };
    const json = gelfUdpDatagram(gelfPayload(big, "host"));
    expect(Buffer.byteLength(json, "utf8")).toBeLessThanOrEqual(8192);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed._stack).toBeUndefined();
    expect(typeof parsed.full_message).toBe("string");
  });
});

describe("syslogLine", () => {
  it("formate une ligne RFC 5424 avec la priorité calculée", () => {
    const line = syslogLine(event, { hostname: "host-1", facility: 1 });
    // PRI = facility(1) * 8 + severity(error=3) = 11
    expect(line.startsWith("<11>1 2026-10-13T12:00:00.000Z host-1 statisfy - admin - ")).toBe(
      true,
    );
    expect(line).toContain("user=user-1");
    expect(line).toContain("ip=10.0.0.7");
  });

  it("utilise la facility configurée", () => {
    const line = syslogLine(event, { hostname: "h", facility: 16 });
    expect(line.startsWith("<131>1 ")).toBe(true); // 16*8 + 3
  });
});
