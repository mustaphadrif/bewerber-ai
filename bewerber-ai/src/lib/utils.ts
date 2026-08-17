import { localeTag, type Locale } from "@/lib/i18n/config";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

const DASH = "–";

/**
 * Locale-aware date formatting. `locale` is an optional 2-letter code
 * ("de" | "en" | "ar"); when omitted the previous behavior (de-DE) is kept,
 * so existing callers are unaffected.
 */
export function formatDate(iso: string | null | undefined, locale?: Locale): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  const tag = locale ? localeTag(locale) : "de-DE";
  return d.toLocaleDateString(tag, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(iso: string | null | undefined, locale?: Locale): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;
  const tag = locale ? localeTag(locale) : "de-DE";
  return (
    d.toLocaleDateString(tag, { day: "2-digit", month: "2-digit", year: "numeric" }) +
    ", " +
    d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" })
  );
}

export function initials(firstName?: string | null, lastName?: string | null): string {
  const a = (firstName || "").trim().charAt(0).toUpperCase();
  const b = (lastName || "").trim().charAt(0).toUpperCase();
  return (a + b) || "B";
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
