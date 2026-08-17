/**
 * Server-side i18n helpers. Reads the persisted locale from the
 * "bewerber-locale" cookie so server components can render the correct
 * language with zero hydration flash.
 */
import { cookies } from "next/headers";
import { COOKIE_NAME, DEFAULT_LOCALE, dirOf, isLocale, localeTag, type Locale } from "./config";
import { createTranslator, type TranslateFn } from "./translate";
import { formatDate as fmtDate, formatDateTime as fmtDateTime } from "@/lib/utils";

export async function getLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    const value = store.get(COOKIE_NAME)?.value;
    if (value && isLocale(value)) return value;
  } catch {
    // cookies unavailable (e.g. during build) — fall back to default
  }
  return DEFAULT_LOCALE;
}

export interface ServerI18n {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: TranslateFn;
  formatDate: (iso: string | null | undefined) => string;
  formatDateTime: (iso: string | null | undefined) => string;
}

export async function getI18n(): Promise<ServerI18n> {
  const locale = await getLocale();
  return {
    locale,
    dir: dirOf(locale),
    t: createTranslator(locale),
    formatDate: (iso) => fmtDate(iso, locale),
    formatDateTime: (iso) => fmtDateTime(iso, locale),
  };
}

export { localeTag };
