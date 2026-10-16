import { describe, expect, it } from "vitest";
import { defaultTheme, isTheme, themes } from "@/lib/theme";

describe("isTheme", () => {
  it("accepte les trois thèmes connus", () => {
    for (const theme of themes) expect(isTheme(theme)).toBe(true);
  });

  it("rejette tout le reste (valeur vide, inconnue)", () => {
    expect(isTheme(undefined)).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme("")).toBe(false);
    expect(isTheme("clair")).toBe(false);
  });

  it("suit le système par défaut", () => {
    expect(defaultTheme).toBe("system");
  });
});
