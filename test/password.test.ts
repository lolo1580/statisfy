import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  it("hache puis vérifie un mot de passe", async () => {
    const hash = await hashPassword("s3cret-password");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("s3cret-password", hash)).toBe(true);
    expect(await verifyPassword("mauvais", hash)).toBe(false);
  });

  it("génère un sel différent à chaque hachage", async () => {
    const a = await hashPassword("meme-mot-de-passe");
    const b = await hashPassword("meme-mot-de-passe");
    expect(a).not.toBe(b);
    expect(await verifyPassword("meme-mot-de-passe", a)).toBe(true);
    expect(await verifyPassword("meme-mot-de-passe", b)).toBe(true);
  });

  it("rejette une valeur stockée malformée", async () => {
    expect(await verifyPassword("x", "pas-un-hash")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$aa$bb")).toBe(false);
  });
});
