/**
 * Email Sender — delivery worker core (pure orchestration).
 *
 * This module has NO runtime imports (type-only) so it can be unit-tested
 * with mocked storage + mailer (see scripts/email-delivery.test.mjs). The
 * real wiring (Supabase storage, Gmail REST API, MIME assembly) lives in
 * ./worker.ts.
 *
 * Rules enforced here:
 *  - one recipient at a time (claim → sending → sent/failed)
 *  - per-user calendar-day limit: a daily slot is RESERVED atomically before
 *    every send (server-side advisory-locked reservation, see migration 006),
 *    so concurrent passes can never oversubscribe the user's quota
 *  - normal pacing: ~2000 ms between successful sends (test-injectable sleep)
 *  - retries with exponential backoff for temporary errors
 *  - stop/pause prevents new sends (checked before each claim)
 *  - messageId/threadId are recorded from the real provider response
 *  - honesty: reservations are committed only after a confirmed provider send;
 *    released on any failure; a post-provider bookkeeping error never blindly
 *    retries the recipient and never falsely marks it as sent
 */
import type { AttachmentMeta } from "./types";

export type WorkerRecipientStatus = "pending" | "sending" | "sent" | "failed";
export type WorkerCampaignStatus =
  | "draft"
  | "pending"
  | "sending"
  | "paused"
  | "stopped"
  | "sent"
  | "failed";

export interface WorkerRecipient {
  id: string;
  campaign_id: string;
  email: string;
  status: WorkerRecipientStatus;
  failure_reason: string | null;
  rate_limited: boolean;
  attempts: number;
  next_attempt_at: string | null;
  created_at: string;
}

export interface WorkerCampaign {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  body_html: string;
  body_text: string;
  status: WorkerCampaignStatus;
  queue_state: string;
  from_email: string;
  attachments: AttachmentMeta[];
}

export interface WorkerAttachmentRow {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  content_b64: string;
}

export interface MailerAttachmentInput {
  name: string;
  mimeType: string;
  data: Uint8Array;
}

export interface SendTarget {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  attachments: MailerAttachmentInput[];
}

export interface SentMessage {
  id: string;
  threadId: string;
}

/** Classified delivery error. `temporary` drives retry/backoff decisions. */
export class DeliveryError extends Error {
  readonly temporary: boolean;
  readonly retryAfterSec: number | null;

  constructor(message: string, options: { temporary: boolean; retryAfterSec?: number | null }) {
    super(message);
    this.name = "DeliveryError";
    this.temporary = options.temporary;
    this.retryAfterSec = options.retryAfterSec ?? null;
  }
}

export interface DeliveryStorage {
  listQueuedCampaigns(now: Date): Promise<WorkerCampaign[]>;
  /** Reset recipients stuck in `sending` from a crashed pass. */
  resetStaleSending(campaignId: string, staleBefore: Date): Promise<number>;
  /** Atomically claim the next pending recipient (sets status → sending, attempts+1). */
  claimNextRecipient(campaignId: string, now: Date): Promise<WorkerRecipient | null>;
  loadAttachments(campaignId: string, storageIds: string[]): Promise<WorkerAttachmentRow[]>;
  getDailySentCount(dayKey: string): Promise<number>;
  getDailyLimit(): Promise<number>;
  /** Atomically reserve one daily send slot; null when the daily limit is exhausted. */
  reserveDailySlot(dayKey: string, limit: number): Promise<string | null>;
  /** Commit a reservation after a confirmed provider send (counts as a successful send). */
  commitDailyReservation(reservationId: string, dayKey: string): Promise<void>;
  /** Release a reservation after a failed/retried send so the slot is not consumed. */
  releaseDailyReservation(reservationId: string): Promise<void>;
  campaignPausedOrStopped(campaignId: string): Promise<boolean>;
  countPending(campaignId: string): Promise<number>;
  recordSent(
    recipient: WorkerRecipient,
    messageId: string,
    threadId: string,
    sentAt: string
  ): Promise<void>;
  recordRetry(
    recipient: WorkerRecipient,
    nextAttemptAt: Date,
    attempts: number,
    reason: string
  ): Promise<void>;
  recordFailed(recipient: WorkerRecipient, reason: string, temporary: boolean): Promise<void>;
  recordDailyLimitBlocked(recipient: WorkerRecipient, reason: string): Promise<void>;
  incrementDailyCounter(dayKey: string): Promise<void>;
  updateCampaignProgress(campaignId: string, deltaSent: number, deltaFailed: number): Promise<void>;
  finishCampaign(campaignId: string, status: "sent" | "failed", finishedAt: string): Promise<void>;
  pauseCampaign(campaignId: string, reason: string): Promise<void>;
  logEvent(
    campaignId: string,
    recipientId: string | null,
    eventType: "recipient_sent" | "recipient_failed" | "retried" | "completed",
    message: string | null
  ): Promise<void>;
}

export interface DeliveryMailer {
  send(target: SendTarget): Promise<SentMessage>;
}

export interface DeliveryDeps {
  storage: DeliveryStorage;
  mailer: DeliveryMailer;
  now(): Date;
  /** Calendar-day key for the daily counter, e.g. "2026-08-14" (UTC). */
  dayKey(date: Date): string;
  maxAttempts?: number;
  /** Backoff delay in ms for a given attempt number (1-based). */
  backoffMs?: (attempt: number) => number;
  /** Max sends processed per pass (bounds route runtime). */
  budget?: number;
  staleSendingMinutes?: number;
  /** Test-injectable sleep used for normal pacing (defaults to setTimeout). */
  sleep?: (ms: number) => Promise<void>;
  /** Normal pacing delay between successful sends in ms (default 2000). */
  paceBetweenSendsMs?: number;
}

export interface DeliveryPassResult {
  sent: number;
  failed: number;
  retried: number;
  dailyLimitBlocked: number;
  remaining: number;
  dailyLimit: number;
  dailySent: number;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BUDGET = 10;
const DEFAULT_STALE_MINUTES = 10;
const DEFAULT_PACE_MS = 2000;
const DEFAULT_BACKOFF = (attempt: number): number =>
  Math.min(60_000 * 2 ** Math.max(0, attempt - 1), 3_600_000);
const DEFAULT_SLEEP = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function runDeliveryPass(deps: DeliveryDeps): Promise<DeliveryPassResult> {
  const now = deps.now();
  let budget = deps.budget ?? DEFAULT_BUDGET;
  const maxAttempts = deps.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const backoffMs = deps.backoffMs ?? DEFAULT_BACKOFF;
  const staleMinutes = deps.staleSendingMinutes ?? DEFAULT_STALE_MINUTES;
  const sleep = deps.sleep ?? DEFAULT_SLEEP;
  const paceMs = deps.paceBetweenSendsMs ?? DEFAULT_PACE_MS;

  const result: DeliveryPassResult = {
    sent: 0,
    failed: 0,
    retried: 0,
    dailyLimitBlocked: 0,
    remaining: 0,
    dailyLimit: 0,
    dailySent: 0,
  };

  const campaigns = await deps.storage.listQueuedCampaigns(now);

  for (const campaign of campaigns) {
    if (budget <= 0) break;

    await deps.storage.resetStaleSending(campaign.id, new Date(now.getTime() - staleMinutes * 60_000));

    while (budget > 0) {
      // Stop/pause must prevent new sends — re-checked before every claim.
      if (await deps.storage.campaignPausedOrStopped(campaign.id)) break;

      const recipient = await deps.storage.claimNextRecipient(campaign.id, now);
      if (!recipient) break;

      // Per-user calendar-day limit — a daily slot is reserved atomically
      // before every send so concurrent passes can never oversubscribe it.
      const dailyLimit = await deps.storage.getDailyLimit();
      const dailySent = await deps.storage.getDailySentCount(deps.dayKey(now));
      result.dailyLimit = dailyLimit;
      result.dailySent = dailySent;

      const reservationId = await deps.storage.reserveDailySlot(deps.dayKey(now), dailyLimit);
      if (!reservationId) {
        const reason = `Tageslimit erreicht (${dailySent}/${dailyLimit}) — keine weiteren Sendungen heute.`;
        await deps.storage.recordDailyLimitBlocked(recipient, reason);
        await deps.storage.pauseCampaign(campaign.id, reason);
        await deps.storage.logEvent(campaign.id, recipient.id, "recipient_failed", reason);
        result.dailyLimitBlocked++;
        break;
      }

      // Resolve attachments (bytes stay server-side). Honesty: if the server
      // cannot load the attachment bytes, the recipient fails — the worker
      // never silently sends without attachments.
      const storageIds = campaign.attachments
        .map((a) => a.storage_id)
        .filter((id): id is string => Boolean(id));
      let attachmentRows: WorkerAttachmentRow[] = [];
      let attachmentError: string | null = null;
      if (storageIds.length > 0) {
        try {
          attachmentRows = await deps.storage.loadAttachments(campaign.id, storageIds);
          const loadedIds = new Set(attachmentRows.map((row) => row.id));
          if (storageIds.some((id) => !loadedIds.has(id))) {
            attachmentError = `Anhänge nicht vollständig ladbar (${storageIds.length - attachmentRows.length} fehlend)`;
          }
        } catch (error) {
          attachmentError =
            error instanceof Error ? error.message : "Unbekannter Fehler beim Laden der Anhänge.";
        }
      }
      if (attachmentError) {
        await deps.storage.releaseDailyReservation(reservationId).catch(() => {});
        const reason = `${attachmentError} — kein Versand ohne Anhänge.`;
        await deps.storage.recordFailed(recipient, reason, false);
        await deps.storage.updateCampaignProgress(campaign.id, 0, 1);
        await deps.storage.logEvent(
          campaign.id,
          recipient.id,
          "recipient_failed",
          `${reason} Empfänger: ${recipient.email}`
        );
        result.failed++;
        budget--;
        continue;
      }
      const attachments: MailerAttachmentInput[] = attachmentRows.map((row) => ({
        name: row.name,
        mimeType: row.mime_type,
        data: Buffer.from(row.content_b64, "base64"),
      }));

      let sentOk = false;
      try {
        const sent = await deps.mailer.send({
          to: recipient.email,
          from: campaign.from_email,
          subject: campaign.subject,
          html: campaign.body_html,
          text: campaign.body_text,
          attachments,
        });
        const sentAt = now.toISOString();
        try {
          await deps.storage.recordSent(recipient, sent.id, sent.threadId, sentAt);
          await deps.storage.commitDailyReservation(reservationId, deps.dayKey(now));
          await deps.storage.updateCampaignProgress(campaign.id, 1, 0);
          await deps.storage.logEvent(campaign.id, recipient.id, "recipient_sent", `E-Mail an ${recipient.email} gesendet.`);
          result.sent++;
          sentOk = true;
        } catch (error) {
          // Ambiguous post-provider DB error: the provider confirmed the send
          // but bookkeeping failed. Fail safely — never blindly retry (that
          // could double-send) and never falsely mark the recipient as sent.
          const message = error instanceof Error ? error.message : "Unbekannter Fehler nach dem Versand.";
          await deps.storage.releaseDailyReservation(reservationId).catch(() => {});
          const reason = `E-Mail wurde gesendet, aber der Status konnte nicht gespeichert werden — keine automatische Wiederholung. ${message}`;
          await deps.storage.recordFailed(recipient, reason, false);
          await deps.storage.updateCampaignProgress(campaign.id, 0, 1);
          await deps.storage.logEvent(campaign.id, recipient.id, "recipient_failed", `${reason} Empfänger: ${recipient.email}`);
          result.failed++;
        }
      } catch (error) {
        // Any failed send/retry releases the reserved daily slot first.
        await deps.storage.releaseDailyReservation(reservationId).catch(() => {});
        const message = error instanceof Error ? error.message : "Unbekannter Fehler beim Versand.";
        if (error instanceof DeliveryError && error.temporary && recipient.attempts < maxAttempts) {
          const delayMs = error.retryAfterSec ? error.retryAfterSec * 1000 : backoffMs(recipient.attempts);
          const nextAttemptAt = new Date(now.getTime() + delayMs);
          await deps.storage.recordRetry(recipient, nextAttemptAt, recipient.attempts, message);
          await deps.storage.logEvent(campaign.id, recipient.id, "retried", `Temporärer Fehler für ${recipient.email} — Wiederholung geplant. ${message}`);
          result.retried++;
        } else {
          await deps.storage.recordFailed(recipient, message, error instanceof DeliveryError ? error.temporary : false);
          await deps.storage.updateCampaignProgress(campaign.id, 0, 1);
          await deps.storage.logEvent(campaign.id, recipient.id, "recipient_failed", `Fehler für ${recipient.email}: ${message}`);
          result.failed++;
        }
      }
      budget--;
      // Normal pacing between successful sends. Never applied to retry/backoff
      // or quota handling — those keep their own timing (Retry-After etc.).
      if (sentOk && budget > 0 && (await deps.storage.countPending(campaign.id)) > 0) {
        await sleep(paceMs);
      }
    }

    // Finalize when nothing is left to deliver (and the campaign was not
    // paused/stopped by the user or by the daily limit).
    const remaining = await deps.storage.countPending(campaign.id);
    result.remaining += remaining;
    if (remaining === 0 && !(await deps.storage.campaignPausedOrStopped(campaign.id))) {
      await deps.storage.finishCampaign(campaign.id, "sent", now.toISOString());
      await deps.storage.logEvent(campaign.id, null, "completed", "Kampagne vollständig verarbeitet.");
    }
  }

  return result;
}
