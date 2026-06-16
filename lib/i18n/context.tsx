"use client";

import * as React from "react";
import {
  defaultLocale,
  getLocaleOption,
  getMessages,
  isLocale,
  loadMessages,
  LOCALE_STORAGE_KEY,
  preloadLocales,
  translate,
  type Locale,
  type Messages,
} from "./index";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  messages: Messages;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* ignore */
  }
  return defaultLocale;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(defaultLocale);
  const [messages, setMessages] = React.useState<Messages>(() =>
    getMessages(defaultLocale),
  );
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const stored = readStoredLocale();
    setLocaleState(stored);
    void loadMessages(stored).then(setMessages);
    setReady(true);
    preloadLocales();
  }, []);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    void loadMessages(next).then(setMessages);
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    const option = getLocaleOption(locale);
    document.documentElement.lang = option.htmlLang;
    document.documentElement.dir = option.dir;
  }, [locale, ready]);

  const value = React.useMemo(
    () => ({
      locale,
      setLocale,
      messages,
      t: (key: string, vars?: Record<string, string | number>) =>
        translate(messages, key, vars),
    }),
    [locale, setLocale, messages],
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

export function useLocaleMeta() {
  const { locale } = useI18n();
  return getLocaleOption(locale);
}

export function useRainbowKitLocale() {
  const { locale } = useI18n();
  return getLocaleOption(locale).rainbowKitLocale;
}
