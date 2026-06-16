import type { Locale } from "./config";
import { defaultLocale, isLocale, locales } from "./config";
import es from "./locales/es.json";

export type { Locale } from "./config";
export {
  defaultLocale,
  isLocale,
  locales,
  localeOptions,
  getLocaleOption,
  LOCALE_STORAGE_KEY,
} from "./config";

export type Messages = typeof es;

const localeImporters: Record<Locale, () => Promise<Messages>> = {
  es: async () => es,
  en: async () => (await import("./locales/en.json")).default as Messages,
  de: async () => (await import("./locales/de.json")).default as Messages,
  ar: async () => (await import("./locales/ar.json")).default as Messages,
  zh: async () => (await import("./locales/zh.json")).default as Messages,
  fr: async () => (await import("./locales/fr.json")).default as Messages,
  hi: async () => (await import("./locales/hi.json")).default as Messages,
  it: async () => (await import("./locales/it.json")).default as Messages,
  ja: async () => (await import("./locales/ja.json")).default as Messages,
  pt: async () => (await import("./locales/pt.json")).default as Messages,
};

const messageCache = new Map<Locale, Messages>([[defaultLocale, es]]);

/** Synchronous access — returns cached messages or the default locale. */
export function getMessages(locale: Locale = defaultLocale): Messages {
  return messageCache.get(locale) ?? messageCache.get(defaultLocale)!;
}

/** Loads and caches locale messages on demand (code-split per locale). */
export async function loadMessages(locale: Locale): Promise<Messages> {
  const cached = messageCache.get(locale);
  if (cached) return cached;
  const importer = localeImporters[locale] ?? localeImporters[defaultLocale];
  const messages = await importer();
  messageCache.set(locale, messages);
  return messages;
}

/** Preload likely locales during idle time to speed up language switches. */
export function preloadLocales(targetLocales: Locale[] = [...locales]): void {
  if (typeof window === "undefined") return;
  const pending = targetLocales.filter((l) => !messageCache.has(l));
  if (pending.length === 0) return;

  const run = () => {
    for (const locale of pending) {
      void loadMessages(locale);
    }
  };

  if ("requestIdleCallback" in globalThis) {
    globalThis.requestIdleCallback(run, { timeout: 4000 });
  } else {
    globalThis.setTimeout(run, 1500);
  }
}

export function translate(
  dict: Messages,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const parts = key.split(".");
  let current: unknown = dict;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return key;
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current !== "string") return key;
  if (!vars) return current;
  return current.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] != null ? String(vars[name]) : `{${name}}`,
  );
}

/** Server-side copy — defaults to Spanish */
export function t(
  key: string,
  vars?: Record<string, string | number>,
  locale: Locale = defaultLocale,
): string {
  return translate(getMessages(locale), key, vars);
}
