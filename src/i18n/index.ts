import type { Locale } from "./config";
import { en, type Dictionary } from "./dictionaries/en";
import { fr } from "./dictionaries/fr";

const DICTIONARIES: Record<Locale, Dictionary> = { en, fr };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? en;
}

export type Vars = Record<string, string | number>;

/** Remplace les jetons `{clé}` d'une chaîne traduite. */
export function translate(
  dictionary: Dictionary,
  key: string,
  vars?: Vars,
): string {
  let value = dictionary[key] ?? key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replaceAll(`{${name}}`, String(replacement));
    }
  }
  return value;
}

export type Translator = (key: string, vars?: Vars) => string;

export { en, fr };
export type { Dictionary };
