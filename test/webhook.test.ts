import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/log", () => ({ logEvent: vi.fn() }));

import {
  buildWebhookRequest,
  isWebhookUrl,
  signWebhook,
  type WebhookPayload,
} from "@/lib/webhook";

const PAYLOAD: WebhookPayload = {
  event: "sync.completed",
  title: "Statisfy — synchronization",
  message: "🎧 12 new play(s) synced from Spotify.",
  timestamp: "2026-10-25T12:00:00.000Z",
  user: { name: "Laurent", email: "laurent@example.com" },
  data: { inserted: 12, total: 40 },
};

describe("isWebhookUrl", () => {
  it("accepte http et https", () => {
    expect(isWebhookUrl("https://example.com/hook")).toBe(true);
    expect(isWebhookUrl("http://192.168.1.10:8123/api/webhook/x")).toBe(true);
  });

  it("refuse les autres schémas et les URLs invalides", () => {
    expect(isWebhookUrl("ftp://example.com/hook")).toBe(false);
    expect(isWebhookUrl("javascript:alert(1)")).toBe(false);
    expect(isWebhookUrl("not a url")).toBe(false);
    expect(isWebhookUrl("")).toBe(false);
  });
});

describe("buildWebhookRequest", () => {
  it("adapte le corps pour Discord", () => {
    const { body, headers } = buildWebhookRequest(
      "https://discord.com/api/webhooks/123/abc",
      PAYLOAD,
    );
    expect(JSON.parse(body)).toEqual({ content: PAYLOAD.message });
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Statisfy-Event"]).toBe("sync.completed");
  });

  it("adapte le corps pour ntfy", () => {
    const { body, headers } = buildWebhookRequest(
      "https://ntfy.sh/statisfy",
      PAYLOAD,
    );
    expect(body).toBe(PAYLOAD.message);
    expect(headers.Title).toBe(PAYLOAD.title);
    expect(headers["Content-Type"]).toContain("text/plain");
    expect(headers.Tags).toBe("arrows_counterclockwise");
  });

  it("envoie un JSON générique pour les autres services", () => {
    const { body, headers } = buildWebhookRequest(
      "http://192.168.1.10:8123/api/webhook/statisfy",
      PAYLOAD,
      "secret",
    );
    expect(JSON.parse(body)).toEqual(PAYLOAD);
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Statisfy-Signature"]).toBe(signWebhook("secret", body));
  });

  it("n'ajoute pas de signature sans secret", () => {
    const { headers } = buildWebhookRequest(
      "https://example.com/hook",
      PAYLOAD,
    );
    expect(headers["X-Statisfy-Signature"]).toBeUndefined();
  });

  it("tronque les messages Discord trop longs", () => {
    const { body } = buildWebhookRequest(
      "https://discord.com/api/webhooks/123/abc",
      { ...PAYLOAD, message: "x".repeat(5000) },
    );
    expect((JSON.parse(body) as { content: string }).content).toHaveLength(
      2000,
    );
  });
});

describe("signWebhook", () => {
  it("renvoie une signature HMAC-SHA256 stable", () => {
    expect(signWebhook("secret", "{}")).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(signWebhook("secret", "{}")).toBe(signWebhook("secret", "{}"));
    expect(signWebhook("secret", "{}")).not.toBe(signWebhook("other", "{}"));
  });

  it("renvoie null sans secret", () => {
    expect(signWebhook("", "{}")).toBeNull();
  });
});
