import type { Locale as RainbowKitLocale } from "@rainbow-me/rainbowkit";

export const LOCALE_STORAGE_KEY = "valtrix-locale";

/** Same 10 languages as sporestaking */
export const locales = [
  "en",
  "es",
  "de",
  "ar",
  "zh",
  "fr",
  "hi",
  "it",
  "ja",
  "pt",
] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "es";

export type LocaleOption = {
  locale: Locale;
  /** Short region-style code shown in the selector (e.g. US, ES) */
  regionCode: string;
  /** Native language name */
  nativeName: string;
  htmlLang: string;
  dir: "ltr" | "rtl";
  rainbowKitLocale: RainbowKitLocale;
};

export const localeOptions: LocaleOption[] = [
  {
    locale: "en",
    regionCode: "US",
    nativeName: "English",
    htmlLang: "en",
    dir: "ltr",
    rainbowKitLocale: "en-US",
  },
  {
    locale: "es",
    regionCode: "ES",
    nativeName: "Español",
    htmlLang: "es",
    dir: "ltr",
    rainbowKitLocale: "es-419",
  },
  // {
  //   locale: "de",
  //   regionCode: "DE",
  //   nativeName: "Deutsch",
  //   htmlLang: "de",
  //   dir: "ltr",
  //   rainbowKitLocale: "de",
  // },
  // {
  //   locale: "ar",
  //   regionCode: "SA",
  //   nativeName: "العربية",
  //   htmlLang: "ar",
  //   dir: "rtl",
  //   rainbowKitLocale: "ar",
  // },
  // {
  //   locale: "zh",
  //   regionCode: "CN",
  //   nativeName: "中文",
  //   htmlLang: "zh-CN",
  //   dir: "ltr",
  //   rainbowKitLocale: "zh-CN",
  // },
  // {
  //   locale: "fr",
  //   regionCode: "FR",
  //   nativeName: "Français",
  //   htmlLang: "fr",
  //   dir: "ltr",
  //   rainbowKitLocale: "fr",
  // },
  // {
  //   locale: "hi",
  //   regionCode: "IN",
  //   nativeName: "हिन्दी",
  //   htmlLang: "hi",
  //   dir: "ltr",
  //   rainbowKitLocale: "hi",
  // },
  // {
  //   locale: "it",
  //   regionCode: "IT",
  //   nativeName: "Italiano",
  //   htmlLang: "it",
  //   dir: "ltr",
  //   rainbowKitLocale: "en-US",
  // },
  // {
  //   locale: "ja",
  //   regionCode: "JP",
  //   nativeName: "日本語",
  //   htmlLang: "ja",
  //   dir: "ltr",
  //   rainbowKitLocale: "ja",
  // },
  // {
  //   locale: "pt",
  //   regionCode: "PT",
  //   nativeName: "Português",
  //   htmlLang: "pt",
  //   dir: "ltr",
  //   rainbowKitLocale: "pt-BR",
  // },
];

export function isLocale(value: string | null | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export function getLocaleOption(locale: Locale): LocaleOption {
  return localeOptions.find((o) => o.locale === locale) ?? localeOptions[1];
}
