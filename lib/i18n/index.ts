import es from "./locales/es.json";

export type Locale = "es";
export const defaultLocale: Locale = "es";

export type Messages = typeof es;

const messages: Messages = es;

export function getMessages(_locale?: Locale): Messages {
  return messages;
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

/** Spanish copy for server components and non-React code */
export function t(
  key: string,
  vars?: Record<string, string | number>,
): string {
  return translate(messages, key, vars);
}
