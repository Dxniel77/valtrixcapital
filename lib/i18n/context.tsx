"use client";

import * as React from "react";
import { defaultLocale, getMessages, translate, type Messages } from "./index";

type I18nContextValue = {
  locale: typeof defaultLocale;
  messages: Messages;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const messages = React.useMemo(() => getMessages(), []);

  React.useEffect(() => {
    document.documentElement.lang = "es";
    try {
      localStorage.setItem("valtrix-locale", "es");
    } catch {
      /* ignore */
    }
  }, []);

  const value = React.useMemo(
    () => ({
      locale: defaultLocale,
      messages,
      t: (key: string, vars?: Record<string, string | number>) =>
        translate(messages, key, vars),
    }),
    [messages],
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within LocaleProvider");
  }
  return ctx;
}
