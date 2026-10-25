import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    appSetting: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  clampSampleRate,
  getRumConfig,
  getRumSettings,
  getRumStatus,
  invalidateRumConfigCache,
  isRumForcedOffByEnv,
  recordRumForward,
  resetRumStatusCache,
  SETTING_RUM_CONFIG,
  SETTING_RUM_STATUS,
  toClientRumConfig,
} from "@/lib/rum";
import { encryptJson } from "@/lib/crypto";
import {
  isSensitiveRumPath,
  isSensitiveRumUrl,
  normalizeRumUrl,
} from "@/lib/rum-url";
import { parseOpenObserveUrl } from "@/lib/rum-origin";

beforeEach(() => {
  vi.clearAllMocks();
  invalidateRumConfigCache();
  resetRumStatusCache();
  prismaMock.appSetting.findUnique.mockResolvedValue(null);
  prismaMock.appSetting.upsert.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const REQUIRED_ENV = {
  OPENOBSERVE_URL: "https://obs.example.com",
  OPENOBSERVE_RUM_TOKEN: "env-token",
};

function stubRequiredEnv() {
  for (const [key, value] of Object.entries(REQUIRED_ENV)) {
    vi.stubEnv(key, value);
  }
}

function storedConfig(value: Record<string, unknown>) {
  prismaMock.appSetting.findUnique.mockResolvedValue({
    value: JSON.stringify(value),
  });
}

describe("parseOpenObserveUrl", () => {
  it("extrait l'hôte, le chemin et l'origine", () => {
    expect(parseOpenObserveUrl("https://obs.example.com/")).toEqual({
      site: "obs.example.com",
      insecureHTTP: false,
      origin: "https://obs.example.com",
    });
    expect(parseOpenObserveUrl("http://localhost:5080/obs/")).toEqual({
      site: "localhost:5080/obs",
      insecureHTTP: true,
      origin: "http://localhost:5080",
    });
    expect(parseOpenObserveUrl("192.168.1.10:5080")).toEqual({
      site: "192.168.1.10:5080",
      insecureHTTP: true,
      origin: "http://192.168.1.10:5080",
    });
  });

  it("refuse les URLs invalides ou non HTTP(S)", () => {
    expect(parseOpenObserveUrl(undefined)).toBeNull();
    expect(parseOpenObserveUrl("not a url")).toBeNull();
    expect(parseOpenObserveUrl("ftp://example.com")).toBeNull();
  });
});

describe("getRumSettings", () => {
  it("utilise les variables d'environnement comme valeurs par défaut", async () => {
    stubRequiredEnv();
    await expect(getRumSettings()).resolves.toMatchObject({
      enabled: true,
      url: "https://obs.example.com",
      token: "env-token",
      org: "default",
      applicationId: "statisfy",
      service: "statisfy",
      env: "test",
      sampleRate: 100,
      privacy: "mask-user-input",
      persistence: "memory",
      trackResources: false,
      trackLongTasks: false,
      trackUserInteractions: false,
      logsEnabled: true,
      forwardErrorsToLogs: true,
      sessionReplaySampleRate: 0,
      startSessionReplay: false,
    });
    expect(prismaMock.appSetting.findUnique).toHaveBeenCalledWith({
      where: { key: SETTING_RUM_CONFIG },
    });
  });

  it("donne priorité à la configuration enregistrée en base", async () => {
    stubRequiredEnv();
    storedConfig({
      enabled: true,
      url: "http://localhost:5080/obs",
      org: "my-org",
      token: "db-token",
      applicationId: "my-app",
      service: "statisfy-web",
      env: "staging",
      sampleRate: 12.5,
      privacy: "mask",
      persistence: "cookie",
      trackResources: true,
      trackLongTasks: true,
      trackUserInteractions: true,
      logsEnabled: false,
      forwardErrorsToLogs: false,
      sessionReplaySampleRate: 50,
      startSessionReplay: true,
    });

    await expect(getRumConfig()).resolves.toMatchObject({
      clientToken: "db-token",
      site: "localhost:5080/obs",
      baseUrl: "http://localhost:5080/obs",
      organizationIdentifier: "my-org",
      applicationId: "my-app",
      service: "statisfy-web",
      env: "staging",
      sessionSampleRate: 12.5,
      defaultPrivacyLevel: "mask",
      sessionPersistence: "cookie",
      trackResources: true,
      trackLongTasks: true,
      trackUserInteractions: true,
      logsEnabled: false,
      forwardErrorsToLogs: false,
      sessionReplaySampleRate: 50,
      startSessionReplay: true,
      insecureHTTP: true,
      proxyPath: "/api/rum",
    });
  });

  it("tolère un JSON corrompu", async () => {
    stubRequiredEnv();
    prismaMock.appSetting.findUnique.mockResolvedValue({ value: "{not json" });
    await expect(getRumSettings()).resolves.toMatchObject({
      url: "https://obs.example.com",
      token: "env-token",
    });
  });

  it("déchiffre une configuration chiffrée", async () => {
    stubRequiredEnv();
    prismaMock.appSetting.findUnique.mockResolvedValue({
      value: encryptJson({
        enabled: true,
        url: "https://encrypted.example.com",
        org: "enc",
        token: "encrypted-token",
      }),
    });
    await expect(getRumSettings()).resolves.toMatchObject({
      url: "https://encrypted.example.com",
      org: "enc",
      token: "encrypted-token",
    });
  });
});

describe("getRumConfig", () => {
  it("renvoie null si le RUM est désactivé en base", async () => {
    stubRequiredEnv();
    storedConfig({ enabled: false });
    await expect(getRumConfig()).resolves.toBeNull();
  });

  it("renvoie null si OPENOBSERVE_RUM_ENABLED=false, même avec une config en base", async () => {
    stubRequiredEnv();
    vi.stubEnv("OPENOBSERVE_RUM_ENABLED", "false");
    storedConfig({ enabled: true, url: "https://obs.example.com", token: "x" });
    expect(isRumForcedOffByEnv()).toBe(true);
    await expect(getRumConfig()).resolves.toBeNull();
  });

  it("renvoie null sans jeton ou avec une URL invalide", async () => {
    vi.stubEnv("OPENOBSERVE_URL", "https://obs.example.com");
    await expect(getRumConfig()).resolves.toBeNull();

    stubRequiredEnv();
    storedConfig({ url: "bad url" });
    await expect(getRumConfig()).resolves.toBeNull();
  });

  it("nettoie les segments et borne l'échantillonnage", async () => {
    stubRequiredEnv();
    storedConfig({
      org: "../evil",
      sampleRate: 150,
    });
    const config = await getRumConfig();
    expect(config?.organizationIdentifier).toBe("default");
    expect(config?.sessionSampleRate).toBe(100);

    storedConfig({ sampleRate: -10 });
    invalidateRumConfigCache();
    expect((await getRumConfig())?.sessionSampleRate).toBe(0);
  });
});

describe("toClientRumConfig", () => {
  it("retire le jeton réel et impose le proxy same-origin", async () => {
    stubRequiredEnv();
    const server = await getRumConfig();
    expect(server).not.toBeNull();
    const client = toClientRumConfig(server!);

    expect(client).toMatchObject({
      clientToken: "proxy",
      proxy: "/api/rum",
    });
    expect(client).not.toHaveProperty("baseUrl");
    expect(client).not.toHaveProperty("proxyPath");
    expect(JSON.stringify(client)).not.toContain("env-token");
  });
});

describe("clampSampleRate", () => {
  it("borne entre 0 et 100", () => {
    expect(clampSampleRate(-1)).toBe(0);
    expect(clampSampleRate(42)).toBe(42);
    expect(clampSampleRate(101)).toBe(100);
    expect(clampSampleRate(Number.NaN)).toBe(100);
  });
});

describe("RUM status", () => {
  it("lit le dernier état depuis la base", async () => {
    prismaMock.appSetting.findUnique.mockResolvedValue({
      value: JSON.stringify({
        lastEventAt: "2026-10-25T11:59:00.000Z",
        lastTrack: "logs",
        lastErrorAt: "2026-10-25T11:58:00.000Z",
        lastErrorStatus: 401,
        lastError: "HTTP 401",
      }),
    });

    await expect(getRumStatus()).resolves.toEqual({
      lastEventAt: "2026-10-25T11:59:00.000Z",
      lastTrack: "logs",
      lastErrorAt: "2026-10-25T11:58:00.000Z",
      lastErrorStatus: 401,
      lastError: "HTTP 401",
    });
    expect(prismaMock.appSetting.findUnique).toHaveBeenCalledWith({
      where: { key: SETTING_RUM_STATUS },
    });
  });

  it("enregistre le dernier événement réussi", async () => {
    await recordRumForward(
      "rum",
      { ok: true, status: 204 },
      new Date("2026-10-25T12:00:10.000Z"),
    );

    await expect(getRumStatus()).resolves.toMatchObject({
      lastEventAt: "2026-10-25T12:00:10.000Z",
      lastTrack: "rum",
    });
    expect(prismaMock.appSetting.upsert).toHaveBeenCalled();
  });

  it("enregistre la dernière erreur", async () => {
    await recordRumForward(
      "logs",
      { ok: false, status: 403, error: "HTTP 403" },
      new Date("2026-10-25T12:00:40.000Z"),
    );

    await expect(getRumStatus()).resolves.toMatchObject({
      lastErrorAt: "2026-10-25T12:00:40.000Z",
      lastErrorStatus: 403,
      lastError: "HTTP 403",
    });
  });
});

describe("normalizeRumUrl", () => {
  it("retire query/hash et normalise les routes dynamiques", () => {
    expect(normalizeRumUrl("https://stats.example.com/dashboard?range=30#x")).toBe(
      "https://stats.example.com/dashboard",
    );
    expect(
      normalizeRumUrl("https://stats.example.com/artist/abc123?x=1"),
    ).toBe("https://stats.example.com/artist/[id]");
    expect(
      normalizeRumUrl("https://stats.example.com/track/abc123"),
    ).toBe("https://stats.example.com/track/[id]");
    expect(
      normalizeRumUrl("https://stats.example.com/share/wrapped/secret"),
    ).toBe("https://stats.example.com/share/wrapped/[token]");
  });

  it("rédige les pages sensibles", () => {
    expect(isSensitiveRumPath("/settings/data")).toBe(true);
    expect(isSensitiveRumPath("/admin/instance")).toBe(true);
    expect(isSensitiveRumPath("/dashboard")).toBe(false);
    expect(isSensitiveRumUrl("https://stats.example.com/settings/data")).toBe(
      true,
    );
    expect(normalizeRumUrl("https://stats.example.com/settings/data?x=1")).toBe(
      "https://stats.example.com/settings/[redacted]",
    );
    expect(normalizeRumUrl("https://stats.example.com/admin")).toBe(
      "https://stats.example.com/admin/[redacted]",
    );
  });

  it("ignore une URL invalide", () => {
    expect(normalizeRumUrl("not a url")).toBeNull();
  });
});
