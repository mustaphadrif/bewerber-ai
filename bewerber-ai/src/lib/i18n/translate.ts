/**
 * Framework-free translation core, shared by the client provider and the
 * server helper. Lookup order: active locale → German (fallback) → key path
 * (never undefined, so users never see "translation.x.y").
 */
import { DEFAULT_LOCALE, type Locale } from "./config";
import { de } from "./dictionaries/de";
import { en } from "./dictionaries/en";
import { ar } from "./dictionaries/ar";

const DICTIONARIES: Record<Locale, Record<string, unknown>> = { de, en, ar };

export type Dictionary = typeof de;

/** Recursive dot-path type, e.g. "dashboard.title" | "nav.cv". */
export type TranslationKey = NestedKeyOf<Dictionary>;

type NestedKeyOf<T> = {
  [K in keyof T & string]: T[K] extends object
    ? `${K}.${NestedKeyOf<T[K]>}` | K
    : K;
}[keyof T & string];

export type TranslateFn = (key: TranslationKey, vars?: Record<string, string | number>) => string;

function lookupValue(source: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let node: unknown = source;
  for (const part of parts) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

export function translate(locale: Locale, key: string): string {
  const direct = lookupValue(DICTIONARIES[locale], key);
  if (direct !== undefined) return direct;
  const fallback = lookupValue(DICTIONARIES[DEFAULT_LOCALE], key);
  if (fallback !== undefined) return fallback;
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[i18n] Missing translation key: ${key}`);
  }
  return key;
}

export function createTranslator(locale: Locale): TranslateFn {
  return (key, vars) => {
    let text = translate(locale, key);
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.split(`{{${name}}}`).join(String(value));
      }
    }
    return text;
  };
}
