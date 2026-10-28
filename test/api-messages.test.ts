import { describe, expect, it } from "vitest";
import { apiLocale, apiMessage } from "@/lib/api/messages";

const request = (acceptLanguage?: string) =>
  new Request("http://localhost/api/public/stats", {
    headers: acceptLanguage ? { "accept-language": acceptLanguage } : {},
  });

describe("messages d'erreur de l'API", () => {
  it("répond en anglais par défaut", () => {
    expect(apiLocale(request())).toBe("en");
    expect(apiMessage(request(), "unauthorized")).toBe("Unauthorized");
  });

  it("suit Accept-Language (français en premier)", () => {
    const req = request("fr-FR,fr;q=0.9,en;q=0.8");
    expect(apiLocale(req)).toBe("fr");
    expect(apiMessage(req, "rateLimited")).toContain("Trop de requêtes");
  });

  it("ignore les langues désactivées avec q=0", () => {
    expect(apiLocale(request("fr;q=0,en;q=0.5"))).toBe("en");
  });

  it("retombe sur l'anglais pour une langue non supportée", () => {
    expect(apiLocale(request("de-DE,de;q=0.9"))).toBe("en");
  });
});
