/**
 * Recipient parsing for TXT / CSV / PDF uploads and manual paste.
 * Zero-dependency: PDF extraction uses the browser-native DecompressionStream
 * (text-layer fallback) plus a binary regex scan. When no addresses are found
 * the caller is told explicitly — nothing is ever fabricated.
 */
import type { DraftRecipient } from "./types";
import { extractEmail, normalizeEmail } from "./validation";

export interface RecipientParseResult {
  rows: DraftRecipient[];
  stats: {
    input: number;
    valid: number;
    invalid: number;
    duplicatesRemoved: number;
  };
  notice?: string;
  fileName?: string;
}

interface ColumnMap {
  emailIdx: number;
  companyIdx: number | null;
  contactIdx: number | null;
}

const EMAIL_HEADER = /^(e-?mail|email-?adresse|adresse|e-?mail-?adresse)$/i;
const EMAIL_HEADER_CONTAINS = /e-?mail/i;
const COMPANY_HEADER = /^(firma|company|unternehmen|organisation|org)$/i;
const CONTACT_HEADER = /^(kontakt|contact|ansprechpartner|name|kontaktperson)$/i;

/** Parse a pasted block (newlines, commas, semicolons, display names). */
export function parsePastedText(text: string): RecipientParseResult {
  return processEntries(splitEntries(text).map(toRawEntry), undefined);
}

/** Parse an uploaded file (TXT/CSV/PDF). */
export async function parseRecipientFile(file: File): Promise<RecipientParseResult> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return parsePdfFile(file);

  const text = await readText(file);
  return processCsv(text, file.name);
}

/* ── CSV ─────────────────────────────────────────────────────────────────── */

interface RawEntry {
  text: string;
  company?: string;
  contact_name?: string;
}

function toRawEntry(text: string): RawEntry {
  return { text };
}

function processCsv(text: string, fileName: string): RecipientParseResult {
  const rows = parseCsv(text);
  const header = rows[0];
  const columnMap = findColumnMap(header);

  const entries: RawEntry[] = [];
  const start = columnMap ? 1 : 0;
  for (let r = start; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0) continue;
    if (columnMap) {
      const emailCell = row[columnMap.emailIdx] ?? "";
      const trimmed = emailCell.trim();
      if (!trimmed) continue;
      entries.push({
        text: trimmed,
        company: columnMap.companyIdx !== null ? row[columnMap.companyIdx]?.trim() : undefined,
        contact_name: columnMap.contactIdx !== null ? row[columnMap.contactIdx]?.trim() : undefined,
      });
    } else {
      const atCells = row.filter((c) => c.includes("@"));
      if (atCells.length > 0) {
        entries.push(...atCells.map(toRawEntry));
      } else if (row.length === 1 && row[0].trim()) {
        entries.push(toRawEntry(row[0]));
      }
    }
  }

  return processEntries(entries, undefined, fileName);
}

/** Map CSV columns by header names. Never infers company/contact from email. */
function findColumnMap(header: string[] | undefined): ColumnMap | null {
  if (!header) return null;
  const hasEmailHeader = header.some((cell) => EMAIL_HEADER_CONTAINS.test(cell.trim()));
  if (!hasEmailHeader) return null;

  const map: ColumnMap = { emailIdx: -1, companyIdx: null, contactIdx: null };
  header.forEach((cell, idx) => {
    const value = cell.trim();
    if (EMAIL_HEADER.test(value) && map.emailIdx === -1) map.emailIdx = idx;
    if (COMPANY_HEADER.test(value) && map.companyIdx === null) map.companyIdx = idx;
    if (CONTACT_HEADER.test(value) && map.contactIdx === null) map.contactIdx = idx;
  });
  if (map.emailIdx === -1) {
    // Fall back to first cell containing an email-like token.
    const idx = header.findIndex((cell) => EMAIL_HEADER_CONTAINS.test(cell.trim()));
    if (idx === -1) return null;
    map.emailIdx = idx;
  }
  return map;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

/* ── Shared entry processing ─────────────────────────────────────────────── */

function splitEntries(text: string): string[] {
  return text.split(/[\r\n,;]+/).map((s) => s.trim()).filter(Boolean);
}

function processEntries(
  rawEntries: RawEntry[],
  columnMap?: ColumnMap,
  fileName?: string
): RecipientParseResult {
  const rows: DraftRecipient[] = [];
  const seen = new Set<string>();
  let valid = 0;
  let invalid = 0;
  let duplicatesRemoved = 0;

  for (const entry of rawEntries) {
    const email = extractEmail(entry.text);
    if (!email) {
      if (entry.text.trim()) invalid++;
      continue;
    }
    if (seen.has(email)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(email);
    valid++;
    rows.push({
      email,
      company: entry.company ?? "",
      contact_name: entry.contact_name ?? "",
      status: "valid",
    });
  }

  void columnMap;

  return {
    rows,
    stats: { input: rawEntries.length, valid, invalid, duplicatesRemoved },
    fileName,
  };
}

/* ── PDF (no-dependency text layer + binary regex fallback) ─────────────── */

async function parsePdfFile(file: File): Promise<RecipientParseResult> {
  const buffer = await file.arrayBuffer();
  const extracted = await extractPdfText(buffer);
  const combined = [extracted.rawScan, ...extracted.decompressed].join("\n");

  if (!combined.trim()) {
    return {
      rows: [],
      stats: { input: 0, valid: 0, invalid: 0, duplicatesRemoved: 0 },
      notice:
        "Keine E-Mail-Adressen in der PDF gefunden. Die Datei enthält vermutlich keine Text-Ebene (z. B. gescanntes Dokument).",
      fileName: file.name,
    };
  }

  // Emails usually live in `(addr)` literal strings inside PDF content streams.
  const literalMatches = [...combined.matchAll(/\(([^()\n]{3,320})\)/g)]
    .map((m) => m[1])
    .filter((s) => s.includes("@"));
  const lines = [...combined.split(/[\r\n]+/), ...literalMatches];
  const result = processEntries(lines.map(toRawEntry), undefined, file.name);

  if (result.stats.valid === 0) {
    result.notice =
      "Keine gültigen E-Mail-Adressen gefunden. Die PDF hat möglicherweise keine lesbare Text-Ebene (gescanntes oder stark komprimiertes Dokument).";
  }
  return result;
}

interface PdfTextExtraction {
  rawScan: string;
  decompressed: string[];
}

async function extractPdfText(buffer: ArrayBuffer): Promise<PdfTextExtraction> {
  const bytes = new Uint8Array(buffer);
  const rawScan = new TextDecoder("latin1").decode(bytes);

  // Strip binary garbage so the regex scan focuses on content streams.
  const cleaned = rawScan
    .replace(/[^\x20-\x7e\r\n()<>@]/g, " ")
    .replace(/\s+/g, " ");

  const decompressed: string[] = [];
  const streamPattern = /stream\r?\n/g;
  const endPattern = /endstream/g;

  let m: RegExpExecArray | null;
  while ((m = streamPattern.exec(rawScan)) !== null) {
    const start = m.index + m[0].length;
    endPattern.lastIndex = start;
    const e = endPattern.exec(rawScan);
    if (!e) break;
    const end = e.index;
    const slice = bytes.slice(start, end);
    const text = await inflateCandidate(slice);
    if (text) {
      decompressed.push(
        text
          .replace(/[^\x20-\x7e\r\n()<>@]/g, " ")
          .replace(/\s+/g, " ")
      );
    }
  }

  return { rawScan: cleaned, decompressed };
}

async function inflateCandidate(bytes: Uint8Array): Promise<string | null> {
  if (typeof DecompressionStream === "undefined") return null;
  for (const format of ["deflate", "deflate-raw"] as const) {
    try {
      const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(
        new DecompressionStream(format)
      );
      const text = await new Response(stream).text();
      if (text.includes("@") || text.trim().length > 0) return text;
    } catch {
      // try next format
    }
  }
  return null;
}

async function readText(file: File): Promise<string> {
  return file.text();
}

export { normalizeEmail };
