import "server-only";

import { cookies } from "next/headers";
import { getDictionary, translate, type Dictionary, type Translator } from ".";
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from "./config";

export type ServerI18n = {
  locale: Locale;
  dictionary: Dictionary;
  t: Translator;
};

/** Récupère la langue courante (cookie) et son dictionnaire. */
export async function getI18n(): Promise<ServerI18n> {
  const jar = await cookies();
  const fromCookie = jar.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(fromCookie) ? fromCookie : defaultLocale;
  const dictionary = getDictionary(locale);
  return {
    locale,
    dictionary,
    t: (key, vars) => translate(dictionary, key, vars),
  };
}
