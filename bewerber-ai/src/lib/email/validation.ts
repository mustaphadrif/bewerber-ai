/**
 * Email address validation + normalization.
 * Pure functions — safe to import from client components (no Node APIs).
 */

const EMAIL_PATTERN =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Extract a bare address from an entry that may carry a display name
 *  (e.g. `Max Mustermann <max@example.com>`, `"max@example.com"`, `max@example.com,`). */
export function extractEmail(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  // "Name <addr>" / "<addr>"
  const angle = value.match(/<([^<>]+)>/);
  if (angle) return normalizeEmail(angle[1]);

  // Strip surrounding quotes and trailing punctuation (commas/semicolons).
  const cleaned = value
    .replace(/^["'\s]+/, "")
    .replace(/["'\s]+$/, "")
    .replace(/[;,\s]+$/, "");

  // If the entry is a bare address, use it; otherwise scan for the first
  // address-like token inside the string.
  const normalized = normalizeEmail(cleaned);
  if (normalized) return normalized;

  const found = cleaned.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return found ? normalizeEmail(found[0]) : null;
}

/** Normalize: trim, lowercase. Returns null when syntax is invalid. */
export function normalizeEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value.length > 320) return null;
  const [local, domain] = splitOnce(value, "@");
  if (!local || !domain) return null;
  if (local.length > 64) return null;
  // Reject quoted locals entirely (rare; keep parsing predictable).
  if (local.includes('"')) return null;
  const candidate = `${local}@${domain}`;
  return EMAIL_PATTERN.test(candidate) ? candidate : null;
}

/** Valid, normalized addresses from arbitrary pasted text. */
export function extractAddressesFromText(text: string): string[] {
  const candidates = text.split(/[\s,;]+/);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of candidates) {
    const email = extractEmail(raw);
    if (email && !seen.has(email)) {
      seen.add(email);
      result.push(email);
    }
  }
  return result;
}

export function isValidEmail(raw: string): boolean {
  return normalizeEmail(raw) !== null;
}

function splitOnce(value: string, separator: string): [string, string | null] {
  const index = value.indexOf(separator);
  if (index === -1) return [value, null];
  return [value.slice(0, index), value.slice(index + 1)];
}

/** Simple string comparison helper used by tests/UI only — NOT for secrets. */
export function maskEmail(email: string): string {
  const [local, domain] = splitOnce(email, "@");
  if (!domain) return email;
  if (local.length <= 2) return `${local}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}
