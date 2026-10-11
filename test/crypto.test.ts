import { describe, expect, it } from "vitest";
import { decryptJson, encryptJson, randomToken, sha256 } from "@/lib/crypto";

describe("crypto", () => {
  it("chiffre puis déchiffre du JSON (AES-256-GCM)", () => {
    const payload = { accessToken: "abc", nested: { n: 1 }, list: [1, 2, 3] };
    const token = encryptJson(payload);
    expect(token.startsWith("v1.")).toBe(true);
    expect(decryptJson(token)).toEqual(payload);
  });

  it("produit un chiffré différent à chaque appel (IV aléatoire)", () => {
    expect(encryptJson({ a: 1 })).not.toBe(encryptJson({ a: 1 }));
  });

  it("rejette un chiffré malformé", () => {
    expect(() => decryptJson("nope")).toThrow();
    expect(() => decryptJson("v2.a.b.c")).toThrow();
  });

  it("génère des jetons uniques", () => {
    expect(randomToken(16)).toHaveLength(22);
    expect(randomToken()).not.toBe(randomToken());
  });

  it("hache de façon déterministe", () => {
    expect(sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
