import { describe, expect, it } from "vitest";
import { normalizeIp, pickClientIp } from "@/lib/client-ip";

describe("normalizeIp", () => {
  it("accepte IPv4 et IPv6", () => {
    expect(normalizeIp("1.2.3.4")).toBe("1.2.3.4");
    expect(normalizeIp("2001:db8::1")).toBe("2001:db8::1");
    expect(normalizeIp(" ::1 ")).toBe("::1");
  });

  it("tolère un port IPv4 et ignore le reste", () => {
    expect(normalizeIp("1.2.3.4:5678")).toBe("1.2.3.4");
  });

  it("rejette les valeurs non-IP", () => {
    expect(normalizeIp("not-an-ip")).toBeNull();
    expect(normalizeIp("")).toBeNull();
    expect(normalizeIp(null)).toBeNull();
    expect(normalizeIp("999.999.999.999")).toBeNull();
  });
});

describe("pickClientIp", () => {
  it("retient le dernier saut de X-Forwarded-For", () => {
    expect(pickClientIp("203.0.113.1, 10.0.0.1", null)).toBe("10.0.0.1");
  });

  it("ignore les sauts forgés non-IP en tête", () => {
    expect(pickClientIp("evil, 1.2.3.4", null)).toBe("1.2.3.4");
  });

  it("ne retombe pas sur un saut antérieur si le dernier est invalide", () => {
    // Dernier saut non-IP : on ne doit PAS récupérer 1.1.1.1 (potentiellement forgé).
    expect(pickClientIp("1.1.1.1, garbage", null)).toBe("local");
  });

  it("utilise X-Real-IP en repli", () => {
    expect(pickClientIp(null, "5.6.7.8")).toBe("5.6.7.8");
    expect(pickClientIp("garbage", "5.6.7.8")).toBe("5.6.7.8");
  });

  it("renvoie « local » si aucune IP valide", () => {
    expect(pickClientIp(null, null)).toBe("local");
    expect(pickClientIp("nope", "nope")).toBe("local");
  });
});
