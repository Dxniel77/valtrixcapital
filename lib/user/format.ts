import { getLocaleOption } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";

export function formatMemberSince(timestamp: number, locale: Locale): string {
  const { htmlLang } = getLocaleOption(locale);
  const formatted = new Date(timestamp).toLocaleDateString(htmlLang, {
    month: "long",
    year: "numeric",
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
