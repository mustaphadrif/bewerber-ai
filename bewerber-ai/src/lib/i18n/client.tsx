"use client";

/**
 * Client-side i18n provider. The initial locale is passed from the server
 * (cookie-derived) so SSR and hydration always agree. Switching languages
 * persists to both localStorage["bewerber-locale"] (spec) and a cookie
 * (SSR support) and updates <html lang/dir> immediately.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  COOKIE_MAX_AGE,
  COOKIE_NAME,
  DEFAULT_LOCALE,
  dirOf,
  isLocale,
  localeTag,
  STORAGE_KEY,
  type Locale,
} from "./config";
import { createTranslator, type TranslateFn } from "./translate";
import { formatDate as fmtDate, formatDateTime as fmtDateTime } from "@/lib/utils";

export interface I18nValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: TranslateFn;
  setLocale: (next: Locale) => void;
  formatDate: (iso: string | null | undefined) => string;
  formatDateTime: (iso: string | null | undefined) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale: initialLocale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Keep the client in sync with the persisted choice if the server cookie
  // was missing/stale (e.g. cookies cleared between visits).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && isLocale(stored) && stored !== locale) {
        setLocaleState(stored);
        document.documentElement.lang = stored;
        document.documentElement.dir = dirOf(stored);
      }
    } catch {
      // storage unavailable — ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirOf(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    try {
      document.cookie = `${COOKIE_NAME}=${next};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
    } catch {
      // ignore
    }
    document.documentElement.lang = next;
    document.documentElement.dir = dirOf(next);
  }, []);

  const t = useMemo(() => createTranslator(locale), [locale]);

  const formatDate = useCallback(
    (iso: string | null | undefined) => fmtDate(iso, locale),
    [locale]
  );
  const formatDateTime = useCallback(
    (iso: string | null | undefined) => fmtDateTime(iso, locale),
    [locale]
  );

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir: dirOf(locale),
      t,
      setLocale,
      formatDate,
      formatDateTime,
    }),
    [locale, t, setLocale, formatDate, formatDateTime]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}

export { DEFAULT_LOCALE, isLocale, localeTag };
