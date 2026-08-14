/**
 * Minimal RFC 5322 / MIME message builder (zero external dependencies).
 * Server-side only — never import from client code.
 *
 * Produces a `multipart/alternative` message (text/plain + text/html) or a
 * `multipart/mixed` message with base64 attachments. Helpers included:
 *  - boundary generation
 *  - quoted-printable encoding (text parts)
 *  - base64 / base64url encoding (attachments + Gmail `raw` payload)
 *  - RFC 2047 encoded-words for non-ASCII headers
 *  - RFC 2231 `filename*` for non-ASCII attachment names
 */
import type { AttachmentMeta } from "./types";

const CRLF = "\r\n";
const MAX_QP_LINE = 73;

export interface MimeAttachment {
  name: string;
  mimeType: string;
  data: Uint8Array;
}

export interface MimeMessageInput {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: MimeAttachment[];
  messageId?: string;
  inReplyTo?: string | null;
  references?: string | null;
}

/* ── Small helpers ───────────────────────────────────────────────────────── */

function randomToken(): string {
  return `${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 12)}`;
}

export function buildBoundary(prefix: string): string {
  return `----=_${prefix}_${randomToken()}`;
}

/** RFC 5322 date, e.g. "Fri, 14 Aug 2026 08:00:00 +0000". */
export function formatRfc822Date(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${days[date.getUTCDay()]}, ${pad(date.getUTCDate())} ${months[date.getUTCMonth()]} ` +
    `${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} +0000`
  );
}

export function generateMessageId(from: string): string {
  const domain = from.includes("@") ? from.split("@")[1].trim().replace(/[^a-z0-9.\-]/gi, "") : "localhost";
  return `<${randomToken()}@${domain || "localhost"}>`;
}

/** RFC 2047 encoded-word for non-ASCII header values. */
export function encodeHeaderWord(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  const base64 = Buffer.from(new TextEncoder().encode(value)).toString("base64");
  return `=?UTF-8?B?${base64}?=`;
}

/**
 * RFC 2231 extended filename (percent-encoded UTF-8) with an ASCII fallback.
 * Returns a value suitable for a Content-Type `name` / Content-Disposition
 * `filename` parameter.
 */
export function encodeFilename(name: string): string {
  if (/^[\x20-\x7e]*$/.test(name) && !name.includes('"')) return `"${name}"`;
  const encoded = Array.from(new TextEncoder().encode(name))
    .map((b) => `%${b.toString(16).toUpperCase().padStart(2, "0")}`)
    .join("");
  return `"attachment.bin"; filename*=UTF-8''${encoded}`;
}

/** Quoted-printable encoding with soft line breaks (RFC 2045 §6.7). */
export function encodeQuotedPrintable(text: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let line = "";

  const flushLine = (soft: boolean) => {
    out.push(line + (soft ? "=" : "") + CRLF);
    line = "";
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "\r") continue;
    if (char === "\n") {
      if (line) flushLine(false);
      continue;
    }
    const code = char.charCodeAt(0);
    let segment: string;
    if (code === 0x3d) segment = "=3D";
    else if (code >= 0x20 && code <= 0x7e) segment = char;
    else {
      segment = Array.from(encoder.encode(char))
        .map((b) => `=${b.toString(16).toUpperCase().padStart(2, "0")}`)
        .join("");
    }
    if (line.length + segment.length > MAX_QP_LINE) {
      // Trailing spaces/tabs must not appear at end of a QP line.
      line = line.replace(/[ \t]+$/, (m) => m.replace(/ /g, "=20").replace(/\t/g, "=09"));
      flushLine(true);
    }
    line += segment;
  }
  // Encode trailing whitespace at end of the last line too.
  line = line.replace(/[ \t]+$/, (m) => m.replace(/ /g, "=20").replace(/\t/g, "=09"));
  if (line) flushLine(false);
  return out.join("");
}

/** Base64 with RFC 2045 line folding (76 chars per line). */
export function encodeBase64(data: Uint8Array, maxLine = 76): string {
  const base64 = Buffer.from(data).toString("base64");
  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += maxLine) lines.push(base64.slice(i, i + maxLine));
  return lines.join(CRLF);
}

/** Base64url (Gmail API `raw` field). */
export function toBase64Url(data: Uint8Array): string {
  return Buffer.from(data).toString("base64url");
}

/* ── Message assembly ────────────────────────────────────────────────────── */

function textPart(mimeType: "text/plain" | "text/html", content: string): string[] {
  return [
    `Content-Type: ${mimeType}; charset=UTF-8`,
    "Content-Transfer-Encoding: quoted-printable",
    "",
    encodeQuotedPrintable(content),
  ];
}

function attachmentPart(attachment: MimeAttachment): string[] {
  const filename = encodeFilename(attachment.name);
  return [
    `Content-Type: ${attachment.mimeType}; name=${filename}`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename=${filename}`,
    "",
    encodeBase64(attachment.data),
  ];
}

/**
 * Builds the full RFC 5322 message text (US-ASCII safe).
 * Structure:
 *   multipart/mixed
 *     ├─ multipart/alternative (text/plain + text/html)   (when attachments)
 *     └─ attachment parts                                  (when attachments)
 *   or plain multipart/alternative when there are no attachments.
 */
export function buildMimeMessage(input: MimeMessageInput): string {
  const attachments = input.attachments ?? [];
  const boundary = buildBoundary("Part");
  const altBoundary = attachments.length > 0 ? buildBoundary("Alt") : boundary;
  const messageId = input.messageId ?? generateMessageId(input.from);

  const headers: string[] = [
    `From: ${input.from}`,
    `To: ${input.to}`,
    `Subject: ${encodeHeaderWord(input.subject)}`,
    `Date: ${formatRfc822Date(new Date())}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
  ];
  if (input.inReplyTo) headers.push(`In-Reply-To: ${input.inReplyTo}`);
  if (input.references) headers.push(`References: ${input.references}`);

  const body: string[] = [];
  if (attachments.length > 0) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  } else {
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
  }

  if (attachments.length > 0) {
    // Open outer part and declare the nested alternative.
    body.push(`--${boundary}`);
    body.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    body.push("");
  }

  body.push(`--${altBoundary}`);
  body.push(...textPart("text/plain", input.text || input.html.replace(/<[^>]*>/g, " ")));
  body.push(`--${altBoundary}`);
  body.push(...textPart("text/html", input.html));
  body.push(`--${altBoundary}--`);

  if (attachments.length > 0) {
    for (const attachment of attachments) {
      body.push(`--${boundary}`);
      body.push(...attachmentPart(attachment));
    }
    body.push(`--${boundary}--`);
  }

  return [...headers, "", ...body].join(CRLF);
}

/** Attachment metadata plus bytes, as used by the worker. */
export interface ResolvedAttachment {
  meta: AttachmentMeta;
  data: Uint8Array;
}
