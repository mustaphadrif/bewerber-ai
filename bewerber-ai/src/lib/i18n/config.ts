/**
 * Central i18n configuration.
 *
 * Supported locales: de (default), en, ar (RTL).
 * Language persistence: localStorage["bewerber-locale"] + a same-named cookie
 * so the server can render the correct language without a flash on refresh.
 */
export const LOCALES = ["de", "en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "de";

/** localStorage key (spec-mandated) and cookie name (SSR support). */
export const STORAGE_KEY = "bewerber-locale";
export const COOKIE_NAME = "bewerber-locale";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export interface LocaleOption {
  /** Native name, e.g. "Deutsch". */
  native: string;
  /** Short label used in the compact switcher. */
  short: string;
  dir: "ltr" | "rtl";
}

export const LOCALE_OPTIONS: Record<Locale, LocaleOption> = {
  de: { native: "Deutsch", short: "DE", dir: "ltr" },
  en: { native: "English", short: "EN", dir: "ltr" },
  ar: { native: "العربية", short: "AR", dir: "rtl" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function dirOf(locale: Locale): "ltr" | "rtl" {
  return LOCALE_OPTIONS[locale].dir;
}

/** Map a 2-letter locale to the Intl locale tag used for dates/numbers. */
export function localeTag(locale: Locale): string {
  if (locale === "de") return "de-DE";
  if (locale === "en") return "en-US";
  // Arabic with Latin digits keeps numeric data (ids, counts, amounts) consistent.
  return "ar-EG-u-nu-latn";
}
