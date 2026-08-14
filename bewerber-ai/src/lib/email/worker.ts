/**
 * Email Sender — delivery worker (real server-side wiring).
 *
 * Implements the DeliveryStorage / DeliveryMailer seams of ./worker-core.ts
 * over Supabase (session or service-role client) and the Gmail REST API:
 *  - tokens: decrypted from the AES-GCM ciphertext in gmail_connections,
 *    refreshed via the OAuth token endpoint when expired;
 *  - sends: one recipient at a time, RFC MIME built by ./mime.ts, delivered
 *    via POST /gmail/v1/users/me/messages/send;
 *  - attachments: bytes read server-side from email_attachments via the
 *    service-role client ONLY (the authenticated SELECT policy was dropped in
 *    migration 005); missing server-side access fails the recipient honestly
 *    instead of sending without attachments;
 *  - daily quota: atomic per-user/day reservations via SECURITY DEFINER
 *    functions (migration 006) — committed only after confirmed provider
 *    sends, released on failure, expired by lease cleanup;
 *  - replies: discovered per app-sent thread via the gmail.metadata scope.
 *
 * Honesty: no send is ever claimed without a provider response. When the
 * provider is not configured/connected, no message is sent.
 */
import { type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { buildMimeMessage, toBase64Url } from "./mime";
import { fetchThreadMessages, getAccessTokenForUser, sendGmailMessage } from "./gmail-api";
import {
  DeliveryError,
  runDeliveryPass,
  type DeliveryDeps,
  type DeliveryMailer,
  type DeliveryPassResult,
  type DeliveryStorage,
  type SentMessage,
  type SendTarget,
  type WorkerAttachmentRow,
  type WorkerCampaign,
  type WorkerRecipient,
} from "./worker-core";
import { extractEmail } from "./validation";
import type { AttachmentMeta } from "./types";

export { DeliveryError };

const DEFAULT_DAILY_LIMIT = 100;
const MAX_QUEUED_CAMPAIGNS = 20;
const MAX_REPLY_THREADS = 50;

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/* ── Server-side (service-role) client ───────────────────────────────────── */
// Attachment bytes (email_attachments.content_b64) are readable ONLY by the
// service-role client after migration 005 drops the authenticated SELECT
// policy. The service key stays in env — it is never exposed to the browser.
let adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!adminClient) adminClient = createSupabaseJsClient(url, key);
  return adminClient;
}

/* ── Storage seam (Supabase) ─────────────────────────────────────────────── */

function makeStorage(supabase: SupabaseClient, userId: string): DeliveryStorage {
  return {
    async listQueuedCampaigns(): Promise<WorkerCampaign[]> {
      const { data: connection } = await supabase
        .from("gmail_connections")
        .select("email")
        .eq("user_id", userId)
        .maybeSingle();
      if (!connection?.email) return []; // no connected account → nothing to send

      const { data } = await supabase
        .from("email_campaigns")
        .select("id, user_id, title, subject, body_html, body_text, status, queue_state, attachments")
        .eq("user_id", userId)
        .in("status", ["pending", "sending"])
        .in("queue_state", ["queued", "running"])
        .order("started_at", { ascending: true })
        .limit(MAX_QUEUED_CAMPAIGNS);

      return ((data ?? []) as Array<{
        id: string;
        user_id: string;
        title: string;
        subject: string;
        body_html: string;
        body_text: string;
        status: WorkerCampaign["status"];
        queue_state: string;
        attachments: AttachmentMeta[] | null;
      }>).map((campaign) => ({
        id: campaign.id,
        user_id: campaign.user_id,
        title: campaign.title,
        subject: campaign.subject,
        body_html: campaign.body_html,
        body_text: campaign.body_text,
        status: campaign.status,
        queue_state: campaign.queue_state,
        from_email: connection.email as string,
        attachments: campaign.attachments ?? [],
      }));
    },

    async resetStaleSending(campaignId: string, staleBefore: Date): Promise<number> {
      const { data } = await supabase
        .from("email_recipients")
        .update({ status: "pending", next_attempt_at: null })
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .eq("status", "sending")
        .lt("updated_at", staleBefore.toISOString())
        .select("id");
      return (data ?? []).length;
    },

    async claimNextRecipient(campaignId: string, now: Date): Promise<WorkerRecipient | null> {
      const nowIso = now.toISOString();
      const { data: candidate } = await supabase
        .from("email_recipients")
        .select("*")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .eq("status", "pending")
        .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!candidate) return null;

      const { data: claimed } = await supabase
        .from("email_recipients")
        .update({ status: "sending", attempts: ((candidate as { attempts?: number }).attempts ?? 0) + 1 })
        .eq("id", (candidate as { id: string }).id)
        .eq("user_id", userId)
        .eq("status", "pending")
        .select("*")
        .maybeSingle();
      return claimed ? (claimed as WorkerRecipient) : null;
    },

    async loadAttachments(campaignId: string, storageIds: string[]): Promise<WorkerAttachmentRow[]> {
      if (storageIds.length === 0) return [];
      // Bytes are read with the service-role client only — the authenticated
      // SELECT policy on email_attachments was dropped in migration 005.
      const admin = getAdminClient();
      if (!admin) {
        throw new DeliveryError(
          "Anhänge können serverseitig nicht geladen werden (SUPABASE_SERVICE_ROLE_KEY fehlt).",
          { temporary: false }
        );
      }
      const { data, error } = await admin
        .from("email_attachments")
        .select("id, name, mime_type, size_bytes, content_b64")
        .eq("user_id", userId)
        .in("id", storageIds)
        .or(`campaign_id.eq.${campaignId},campaign_id.is.null`);
      if (error) {
        throw new DeliveryError(`Anhänge können serverseitig nicht geladen werden: ${error.message}`, {
          temporary: false,
        });
      }
      return (data ?? []) as WorkerAttachmentRow[];
    },

    async getDailySentCount(dailyKey: string): Promise<number> {
      const { data } = await supabase
        .from("email_daily_counters")
        .select("sent_count")
        .eq("user_id", userId)
        .eq("day", dailyKey)
        .maybeSingle();
      return ((data as { sent_count?: number } | null)?.sent_count ?? 0) as number;
    },

    async getDailyLimit(): Promise<number> {
      const { data } = await supabase
        .from("user_email_entitlements")
        .select("recipient_limit")
        .eq("user_id", userId)
        .maybeSingle();
      return ((data as { recipient_limit?: number } | null)?.recipient_limit ?? DEFAULT_DAILY_LIMIT) as number;
    },

    async reserveDailySlot(dailyKey: string, limit: number): Promise<string | null> {
      // SECURITY DEFINER function: atomic under a per-user/day advisory lock
      // (migration 006). Authorized via auth.uid() = p_user_id or service_role.
      const { data, error } = await supabase.rpc("reserve_email_daily_slot", {
        p_user_id: userId,
        p_day: dailyKey,
        p_limit: limit,
      });
      if (error) {
        throw new DeliveryError(`Tageslimit-Reservierung fehlgeschlagen: ${error.message}`, {
          temporary: false,
        });
      }
      return (data as string | null) ?? null;
    },

    async commitDailyReservation(reservationId: string, _dailyKey: string): Promise<void> {
      void _dailyKey;
      const { error } = await supabase.rpc("commit_email_daily_reservation", {
        p_reservation_id: reservationId,
        p_user_id: userId,
      });
      if (error) {
        throw new Error(`Reservierung konnte nicht bestätigt werden: ${error.message}`);
      }
    },

    async releaseDailyReservation(reservationId: string): Promise<void> {
      const { error } = await supabase.rpc("release_email_daily_reservation", {
        p_reservation_id: reservationId,
        p_user_id: userId,
      });
      if (error) {
        throw new Error(`Reservierung konnte nicht freigegeben werden: ${error.message}`);
      }
    },

    async campaignPausedOrStopped(campaignId: string): Promise<boolean> {
      const { data } = await supabase
        .from("email_campaigns")
        .select("status")
        .eq("id", campaignId)
        .maybeSingle();
      if (!data) return true;
      const status = (data as { status: string }).status;
      return status === "paused" || status === "stopped";
    },

    async countPending(campaignId: string): Promise<number> {
      const { data } = await supabase
        .from("email_recipients")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .eq("status", "pending");
      return (data ?? []).length;
    },

    async recordSent(recipient: WorkerRecipient, messageId: string, threadId: string, sentAt: string): Promise<void> {
      // Errors must propagate: after a confirmed provider send, a failing
      // bookkeeping write is ambiguous and must NOT be silently ignored
      // (worker-core then fails the recipient safely instead of retrying).
      const { error } = await supabase
        .from("email_recipients")
        .update({
          status: "sent",
          sent_at: sentAt,
          gmail_message_id: messageId,
          gmail_thread_id: threadId,
          failure_reason: null,
          rate_limited: false,
          next_attempt_at: null,
        })
        .eq("id", recipient.id)
        .eq("user_id", userId);
      if (error) throw new Error(`Status konnte nicht gespeichert werden: ${error.message}`);
    },

    async recordRetry(recipient: WorkerRecipient, nextAttemptAt: Date, _attempts: number, reason: string): Promise<void> {
      await supabase
        .from("email_recipients")
        .update({
          status: "pending",
          next_attempt_at: nextAttemptAt.toISOString(),
          failure_reason: reason,
          rate_limited: true,
        })
        .eq("id", recipient.id)
        .eq("user_id", userId);
    },

    async recordFailed(recipient: WorkerRecipient, reason: string, temporary: boolean): Promise<void> {
      await supabase
        .from("email_recipients")
        .update({
          status: "failed",
          failure_reason: reason,
          rate_limited: temporary,
          next_attempt_at: null,
        })
        .eq("id", recipient.id)
        .eq("user_id", userId);
    },

    async recordDailyLimitBlocked(recipient: WorkerRecipient, reason: string): Promise<void> {
      await supabase
        .from("email_recipients")
        .update({ status: "failed", failure_reason: reason, rate_limited: false, next_attempt_at: null })
        .eq("id", recipient.id)
        .eq("user_id", userId);
    },

    async incrementDailyCounter(dailyKey: string): Promise<void> {
      // Atomic increment (server-side function, RLS-enforced).
      await supabase.rpc("increment_email_daily_counter", {
        p_user_id: userId,
        p_day: dailyKey,
      });
    },

    async updateCampaignProgress(campaignId: string, deltaSent: number, deltaFailed: number): Promise<void> {
      const { data: campaign } = await supabase
        .from("email_campaigns")
        .select("sent_count, failed_count")
        .eq("id", campaignId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!campaign) return;
      await supabase
        .from("email_campaigns")
        .update({
          sent_count: Math.max(0, ((campaign as { sent_count: number }).sent_count ?? 0) + deltaSent),
          failed_count: Math.max(0, ((campaign as { failed_count: number }).failed_count ?? 0) + deltaFailed),
        })
        .eq("id", campaignId)
        .eq("user_id", userId);
    },

    async finishCampaign(campaignId: string, status: "sent" | "failed", finishedAt: string): Promise<void> {
      await supabase
        .from("email_campaigns")
        .update({ status, queue_state: "done", finished_at: finishedAt })
        .eq("id", campaignId)
        .eq("user_id", userId);
    },

    async pauseCampaign(campaignId: string, reason: string): Promise<void> {
      await supabase
        .from("email_campaigns")
        .update({ status: "paused", queue_state: "paused", last_error: reason })
        .eq("id", campaignId)
        .eq("user_id", userId);
    },

    async logEvent(
      campaignId: string,
      recipientId: string | null,
      eventType: "recipient_sent" | "recipient_failed" | "retried" | "completed",
      message: string | null
    ): Promise<void> {
      await supabase.from("email_events").insert({
        campaign_id: campaignId,
        user_id: userId,
        recipient_id: recipientId,
        event_type: eventType,
        message,
      });
    },
  };
}

/* ── Mailer seam (Gmail REST API) ────────────────────────────────────────── */

function makeMailer(supabase: SupabaseClient, userId: string): DeliveryMailer {
  return {
    async send(target: SendTarget): Promise<SentMessage> {
      const accessToken = await getAccessTokenForUser(supabase, userId);
      const mime = buildMimeMessage({
        from: target.from,
        to: target.to,
        subject: target.subject,
        text: target.text,
        html: target.html,
        attachments: target.attachments,
      });
      const raw = toBase64Url(Buffer.from(mime, "utf8"));
      const sent = await sendGmailMessage(accessToken, raw);
      return { id: sent.id, threadId: sent.threadId };
    },
  };
}

/* ── Public entry points ─────────────────────────────────────────────────── */

export function makeDeliveryDeps(supabase: SupabaseClient, userId: string): DeliveryDeps {
  return {
    storage: makeStorage(supabase, userId),
    mailer: makeMailer(supabase, userId),
    now: () => new Date(),
    dayKey,
  };
}

/** Runs one delivery pass for a single user (one recipient at a time). */
export async function runDeliveryForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<DeliveryPassResult> {
  return runDeliveryPass(makeDeliveryDeps(supabase, userId));
}

/**
 * Syncs replies for the user's own sent threads (gmail.metadata scope).
 * Only threads of app-sent messages are queried; only messages from other
 * senders are stored. Upsert key: (user_id, gmail_message_id).
 */
export async function syncRepliesForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ synced: number }> {
  const accessToken = await getAccessTokenForUser(supabase, userId);

  const { data: connection } = await supabase
    .from("gmail_connections")
    .select("email")
    .eq("user_id", userId)
    .maybeSingle();
  const myEmail = ((connection as { email?: string | null } | null)?.email ?? "").trim().toLowerCase();

  const { data: recipients } = await supabase
    .from("email_recipients")
    .select("campaign_id, gmail_thread_id")
    .eq("user_id", userId)
    .not("gmail_thread_id", "is", null)
    .order("sent_at", { ascending: false })
    .limit(MAX_REPLY_THREADS);

  let synced = 0;
  const seenThreads = new Set<string>();
  for (const row of (recipients ?? []) as Array<{ campaign_id: string; gmail_thread_id: string }>) {
    if (!row.gmail_thread_id || seenThreads.has(row.gmail_thread_id)) continue;
    seenThreads.add(row.gmail_thread_id);

    const messages = await fetchThreadMessages(accessToken, row.gmail_thread_id);
    for (const message of messages) {
      const fromHeader = message.headers.find((h) => h.name.toLowerCase() === "from")?.value ?? "";
      const fromEmail = extractEmail(fromHeader);
      if (!fromEmail || fromEmail === myEmail || fromEmail === "me") continue;

      const subject = message.headers.find((h) => h.name.toLowerCase() === "subject")?.value ?? null;
      const receivedAt = message.internalDate
        ? new Date(Number(message.internalDate)).toISOString()
        : null;
      const { error } = await supabase.from("email_replies").upsert(
        {
          user_id: userId,
          campaign_id: row.campaign_id,
          thread_id: row.gmail_thread_id,
          gmail_message_id: message.id,
          from_email: fromEmail,
          subject,
          body_text: message.snippet || null,
          received_at: receivedAt,
          is_read: !message.labelIds.includes("UNREAD"),
        },
        { onConflict: "user_id,gmail_message_id" }
      );
      if (!error && message.id) synced++;
    }
  }
  return { synced };
}

/** Whether a server-side worker can currently run (env gate). */
export function workerConfigured(): boolean {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REDIRECT_URI &&
      process.env.EMAIL_TOKEN_ENCRYPTION_KEY
  );
}
