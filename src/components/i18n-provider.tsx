"use client";

import { createContext, useContext, type ReactNode } from "react";
import { translate, type Dictionary, type Vars } from "@/i18n";
import type { Locale } from "@/i18n/config";

type I18nContextValue = {
  locale: Locale;
  dictionary: Dictionary;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  return (
    <I18nContext.Provider value={{ locale, dictionary }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return {
    locale: context.locale,
    t: (key: string, vars?: Vars) => translate(context.dictionary, key, vars),
  };
}
