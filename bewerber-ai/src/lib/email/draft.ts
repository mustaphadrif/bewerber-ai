/**
 * Offline-first draft persistence for unsent campaign content + recipients.
 * NEVER stores OAuth tokens or anything secret — only campaign draft data.
 * Client-only module.
 */
import type { CampaignDraft } from "./types";

const DRAFT_KEY = "email-sender:draft:v1";

export function loadCampaignDraft(): CampaignDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CampaignDraft>;
    if (
      typeof parsed.title !== "string" ||
      typeof parsed.subject !== "string" ||
      typeof parsed.bodyHtml !== "string" ||
      !Array.isArray(parsed.recipients) ||
      !Array.isArray(parsed.attachments)
    ) {
      return null;
    }
    return {
      title: parsed.title,
      subject: parsed.subject,
      bodyHtml: parsed.bodyHtml,
      recipients: parsed.recipients,
      attachments: parsed.attachments,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : null,
    };
  } catch {
    return null;
  }
}

export function saveCampaignDraft(draft: CampaignDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage full/unavailable — ignore; the draft simply is not persisted.
  }
}

export function clearCampaignDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function hasCampaignDraft(): boolean {
  return loadCampaignDraft() !== null;
}

export function formatSavedAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
