import { describe, expect, it } from "vitest";
import { en, fr, translate } from "@/i18n";

/**
 * Garde-fous sur les dictionnaires : la parité en/fr est maintenue à la main,
 * donc un test la vérifie à chaque exécution (clés, variables, non-vacuité).
 */

const placeholders = (value: string): string[] =>
  [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort();

describe("dictionnaires i18n", () => {
  it("expose les mêmes clés en anglais et en français", () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });

  it("ne contient aucune traduction vide", () => {
    for (const [locale, dictionary] of [
      ["en", en],
      ["fr", fr],
    ] as const) {
      for (const [key, value] of Object.entries(dictionary)) {
        expect(value.trim(), `${locale}:${key}`).not.toBe("");
      }
    }
  });

  it("utilise les mêmes variables d'interpolation", () => {
    for (const key of Object.keys(en)) {
      expect(placeholders(fr[key] ?? ""), key).toEqual(placeholders(en[key]));
    }
  });

  it("interpole les variables et retombe sur la clé si elle manque", () => {
    const dictionary = { greeting: "Hello {name} ({count})" };
    expect(translate(dictionary, "greeting", { name: "Ada", count: 2 })).toBe(
      "Hello Ada (2)",
    );
    expect(translate(dictionary, "missing.key")).toBe("missing.key");
  });
});
