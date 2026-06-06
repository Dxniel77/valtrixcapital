import type { Locale } from "./config";
import { defaultLocale, isLocale } from "./config";
import es from "./locales/es.json";
import en from "./locales/en.json";
import de from "./locales/de.json";
import ar from "./locales/ar.json";
import zh from "./locales/zh.json";
import fr from "./locales/fr.json";
import hi from "./locales/hi.json";
import it from "./locales/it.json";
import ja from "./locales/ja.json";
import pt from "./locales/pt.json";

export type { Locale } from "./config";
export { defaultLocale, isLocale, locales, localeOptions, getLocaleOption, LOCALE_STORAGE_KEY } from "./config";

export type Messages = typeof es;

const messageMap: Record<Locale, Messages> = {
  es,
  en,
  de,
  ar,
  zh,
  fr,
  hi,
  it,
  ja,
  pt,
};

export function getMessages(locale: Locale = defaultLocale): Messages {
  return messageMap[locale] ?? messageMap[defaultLocale];
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
