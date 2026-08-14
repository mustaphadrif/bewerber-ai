"use server";

/**
 * Email Sender — server actions (authoritative boundaries).
 *
 * Rules honored here:
 *  - Entitlement limit defaults to 100; the premium limit of 400 is applied
 *    only after validating an activation code against a server-side env var
 *    (EMAIL_SENDER_ACTIVATION_CODE). The env value never reaches the client
 *    and no code is ever hardcoded.
 *  - Gmail tokens are never exposed; provider checks read only metadata.
 *  - No fake "sent" claims: without a configured Gmail provider, queueStart
 *    returns a clear provider-not-configured error.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmail } from "./validation";
import { getGmailOAuthConfig } from "./gmail";
import type {
  CampaignDetail,
  CampaignMetrics,
  CampaignRecipientInput,
  CampaignStatus,
  CampaignWithMetrics,
  CreateCampaignInput,
  DashboardState,
  EmailCampaign,
  EmailEvent,
  EmailEventType,
  EmailRecipient,
  EmailSenderActionResult,
  EntitlementStatus,
  GmailStatus,
  QueueState,
  RecipientStatus,
  UpdateCampaignInput,
} from "./types";

const DEFAULT_RECIPIENT_LIMIT = 100;
const PREMIUM_RECIPIENT_LIMIT = 400;
const ACTIVATION_CODE_ENV = "EMAIL_SENDER_ACTIVATION_CODE";

type Supabase = NonNullable<Awaited<ReturnType<typeof createClient>>>;

interface AuthContext {
  supabase: Supabase;
  userId: string;
}

async function requireEmailUser(): Promise<AuthContext | EmailSenderActionResult> {
  const supabase = await createClient();
  if (!supabase) {
    return { ok: false, error: "Supabase ist nicht konfiguriert." };
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, error: "Nicht angemeldet.", code: "not-authenticated" };
  }
  return { supabase, userId: data.user.id };
}

function isActionResult(v: AuthContext | EmailSenderActionResult): v is EmailSenderActionResult {
  return "ok" in v;
}

function normalizeRecipients(input: CampaignRecipientInput[]): { rows: CampaignRecipientInput[]; rejected: number } {
  const seen = new Set<string>();
  const rows: CampaignRecipientInput[] = [];
  let rejected = 0;
  for (const r of input) {
    const email = normalizeEmail(r.email);
    if (!email || seen.has(email)) {
      rejected++;
      continue;
    }
    seen.add(email);
    rows.push({
      email,
      company: r.company?.trim() ? r.company.trim() : null,
      contact_name: r.contact_name?.trim() ? r.contact_name.trim() : null,
    });
  }
  return { rows, rejected };
}

function computeMetrics(campaign: EmailCampaign, recipients: EmailRecipient[]): CampaignMetrics {
  const total = campaign.total_recipients;
  const sent = recipients.filter((r) => r.status === "sent").length;
  const failed = recipients.filter((r) => r.status === "failed").length;
  const remaining = Math.max(0, total - sent - failed);
  const progressPercent = total === 0 ? 0 : Math.round(((sent + failed) / total) * 100);
  return { total, sent, failed, remaining, progressPercent };
}

function computeMetricsFromCounts(
  campaign: EmailCampaign,
  counts: { sent: number; failed: number }
): CampaignMetrics {
  const sent = counts.sent;
  const failed = counts.failed;
  const remaining = Math.max(0, campaign.total_recipients - sent - failed);
  const progressPercent =
    campaign.total_recipients === 0
      ? 0
      : Math.round(((sent + failed) / campaign.total_recipients) * 100);
  return {
    total: campaign.total_recipients,
    sent,
    failed,
    remaining,
    progressPercent,
  };
}

function toCampaignWithMetrics(campaign: EmailCampaign, recipients: EmailRecipient[]): CampaignWithMetrics {
  return { ...campaign, metrics: computeMetrics(campaign, recipients) };
}

async function getEntitlement(supabase: Supabase, userId: string): Promise<{
  limit: number;
  status: EntitlementStatus;
  activatedAt: string | null;
}> {
  const { data } = await supabase
    .from("user_email_entitlements")
    .select("recipient_limit, status, activated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) {
    return {
      limit: (data.recipient_limit as number) ?? DEFAULT_RECIPIENT_LIMIT,
      status: (data.status as EntitlementStatus) ?? "standard",
      activatedAt: (data.activated_at as string | null) ?? null,
    };
  }
  return { limit: DEFAULT_RECIPIENT_LIMIT, status: "standard", activatedAt: null };
}

async function insertEvent(
  supabase: Supabase,
  userId: string,
  campaignId: string,
  eventType: EmailEventType,
  message: string | null
): Promise<void> {
  await supabase.from("email_events").insert({
    campaign_id: campaignId,
    user_id: userId,
    recipient_id: null,
    event_type: eventType,
    message,
  });
}

/* ── Reads ──────────────────────────────────────────────────────────────── */

export async function getEmailSenderState(): Promise<DashboardState> {
  const ctx = await requireEmailUser();
  if (isActionResult(ctx)) {
    return emptyDashboardState();
  }
  const { supabase, userId } = ctx;

  const [campaignsRes, failedRes, repliesRes, gmailRes] = await Promise.all([
    supabase
      .from("email_campaigns")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("email_recipients")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "failed")
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("email_replies")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("gmail_connections")
      .select("id, user_id, email, provider_account_id, scope, token_expires_at, rate_limit_remaining, rate_limit_reset_at, connected_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const campaigns = (campaignsRes.data ?? []) as EmailCampaign[];
  const recipients = (failedRes.data ?? []) as EmailRecipient[];
  const replies = (repliesRes.data ?? []) as DashboardState["replies"];
  const gmailRow = gmailRes.data as { email: string | null; scope: string | null } | null;

  // Recipient counts for the listed campaigns (bounded set).
  const campaignIds = campaigns.map((c) => c.id);
  const counts = new Map<string, { sent: number; failed: number }>();
  if (campaignIds.length > 0) {
    const { data: countRows } = await supabase
      .from("email_recipients")
      .select("campaign_id, status")
      .in("campaign_id", campaignIds);
    for (const row of (countRows ?? []) as Array<{ campaign_id: string; status: RecipientStatus }>) {
      const entry = counts.get(row.campaign_id) ?? { sent: 0, failed: 0 };
      if (row.status === "sent") entry.sent++;
      if (row.status === "failed") entry.failed++;
      counts.set(row.campaign_id, entry);
    }
  }

  const campaignsWithMetrics: CampaignWithMetrics[] = campaigns.map((c) => {
    const count = counts.get(c.id) ?? { sent: 0, failed: 0 };
    return { ...c, metrics: computeMetricsFromCounts(c, count) };
  });

  const running =
    campaignsWithMetrics.find((c) => c.status === "pending" || c.status === "sending") ?? null;

  const entitlement = await getEntitlement(supabase, userId);

  // Calendar-day successful-send count. The server worker maintains the
  // atomic counter (email_daily_counters); the recipient-based count is only
  // a fallback for rows sent before the counter table existed.
  const todayKey = new Date().toISOString().slice(0, 10);
  const { data: counterRow } = await supabase
    .from("email_daily_counters")
    .select("sent_count")
    .eq("user_id", userId)
    .eq("day", todayKey)
    .maybeSingle();
  const counterSent = (counterRow as { sent_count?: number } | null)?.sent_count ?? 0;

  const { data: sentTodayRows } = await supabase
    .from("email_recipients")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "sent")
    .gte("sent_at", new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z").toISOString());

  const dailySent = Math.max(counterSent, sentTodayRows?.length ?? 0);

  const gmailConfig = getGmailOAuthConfig();
  const gmail: GmailStatus = {
    available: gmailConfig.available,
    connected: Boolean(gmailRow),
    email: gmailRow?.email ?? null,
    scope: gmailRow?.scope ?? null,
  };

  return {
    campaigns: campaignsWithMetrics,
    running,
    failedRecipients: recipients,
    replies,
    entitlement,
    dailySent,
    gmail,
  };
}

function emptyDashboardState(): DashboardState {
  return {
    campaigns: [],
    running: null,
    failedRecipients: [],
    replies: [],
    entitlement: { limit: DEFAULT_RECIPIENT_LIMIT, status: "standard", activatedAt: null },
    dailySent: 0,
    gmail: { available: false, connected: false, email: null, scope: null },
  };
}

export async function getCampaignDetail(id: string): Promise<CampaignDetail | null> {
  const ctx = await requireEmailUser();
  if (isActionResult(ctx)) return null;
  const { supabase, userId } = ctx;

  const { data: campaignRes } = await supabase
    .from("email_campaigns")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!campaignRes) return null;

  const [recipientsRes, eventsRes] = await Promise.all([
    supabase
      .from("email_recipients")
      .select("*")
      .eq("campaign_id", id)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("email_events")
      .select("*")
      .eq("campaign_id", id)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  const campaign = campaignRes as EmailCampaign;
  const recipients = (recipientsRes.data ?? []) as EmailRecipient[];
  const events = (eventsRes.data ?? []) as EmailEvent[];

  return { campaign: toCampaignWithMetrics(campaign, recipients), recipients, events };
}

/* ── Campaign creation / update ─────────────────────────────────────────── */

export async function createCampaign(input: CreateCampaignInput): Promise<EmailSenderActionResult> {
  const ctx = await requireEmailUser();
  if (isActionResult(ctx)) return ctx;
  const { supabase, userId } = ctx;

  const title = input.title.trim();
  if (!title) {
    return { ok: false, error: "Ein Kampagnenname ist erforderlich.", code: "invalid-input" };
  }
  const { rows, rejected } = normalizeRecipients(input.recipients);
  if (rows.length === 0) {
    return { ok: false, error: "Mindestens eine gültige Empfängeradresse ist erforderlich.", code: "invalid-input" };
  }

  const entitlement = await getEntitlement(supabase, userId);
  if (rows.length > entitlement.limit) {
    return {
      ok: false,
      error: `Empfängerlimit überschritten (max. ${entitlement.limit} pro Kampagne).`,
      code: "invalid-input",
    };
  }

  const { data, error } = await supabase
    .from("email_campaigns")
    .insert({
      user_id: userId,
      title,
      subject: input.subject.trim(),
      body_html: input.body_html,
      body_text: input.body_text.trim(),
      status: "draft",
      queue_state: "idle",
      total_recipients: rows.length,
      sent_count: 0,
      failed_count: 0,
      attachments: input.attachments,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Kampagne konnte nicht angelegt werden." };
  }
  const campaignId = (data as { id: string }).id;

  const recipientRows = rows.map((r) => ({
    campaign_id: campaignId,
    user_id: userId,
    email: r.email,
    company: r.company ?? null,
    contact_name: r.contact_name ?? null,
    status: "pending" as RecipientStatus,
  }));
  const { error: recipientsError } = await supabase.from("email_recipients").insert(recipientRows);
  if (recipientsError) {
    return { ok: false, error: recipientsError.message };
  }

  // Bind previously uploaded attachment bytes to this campaign (metadata is
  // already part of the campaign row; bytes stay server-side).
  const storageIds = (input.attachments ?? [])
    .map((a) => a.storage_id)
    .filter((id): id is string => Boolean(id));
  if (storageIds.length > 0) {
    await supabase
      .from("email_attachments")
      .update({ campaign_id: campaignId })
      .eq("user_id", userId)
      .in("id", storageIds);
  }

  await insertEvent(supabase, userId, campaignId, "created", `Kampagne angelegt (${rows.length} Empfänger${rejected > 0 ? `, ${rejected} ungültig/doppelt verworfen` : ""}).`);

  revalidatePath("/email-sender");
  return { ok: true, campaignId };
}

export async function updateCampaign(id: string, input: UpdateCampaignInput): Promise<EmailSenderActionResult> {
  const ctx = await requireEmailUser();
  if (isActionResult(ctx)) return ctx;
  const { supabase, userId } = ctx;

  const { data: existing } = await supabase
    .from("email_campaigns")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Kampagne nicht gefunden.", code: "not-allowed" };

  const status = existing.status as CampaignStatus;
  if (status !== "draft" && status !== "pending") {
    return {
      ok: false,
      error: "Eine laufende, gestoppte oder beendete Kampagne kann nicht mehr bearbeitet werden.",
      code: "not-allowed",
    };
  }

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Ein Kampagnenname ist erforderlich.", code: "invalid-input" };

  const { rows, rejected } = normalizeRecipients(input.recipients);
  if (rows.length === 0) {
    return { ok: false, error: "Mindestens eine gültige Empfängeradresse ist erforderlich.", code: "invalid-input" };
  }
  const entitlement = await getEntitlement(supabase, userId);
  if (rows.length > entitlement.limit) {
    return {
      ok: false,
      error: `Empfängerlimit überschritten (max. ${entitlement.limit} pro Kampagne).`,
      code: "invalid-input",
    };
  }

  const { error: updateError } = await supabase
    .from("email_campaigns")
    .update({
      title,
      subject: input.subject.trim(),
      body_html: input.body_html,
      body_text: input.body_text.trim(),
      total_recipients: rows.length,
      attachments: input.attachments,
    })
    .eq("id", id)
    .eq("user_id", userId);
  if (updateError) return { ok: false, error: updateError.message };

  // Replace recipients only while the campaign has never started.
  await supabase.from("email_recipients").delete().eq("campaign_id", id).eq("user_id", userId);
  await supabase.from("email_recipients").insert(
    rows.map((r) => ({
      campaign_id: id,
      user_id: userId,
      email: r.email,
      company: r.company ?? null,
      contact_name: r.contact_name ?? null,
      status: "pending" as RecipientStatus,
    }))
  );

  // Re-bind attachments: detach removed ones, attach newly added ones.
  const newStorageIds = (input.attachments ?? [])
    .map((a) => a.storage_id)
    .filter((id): id is string => Boolean(id));
  const { data: existingAttachments } = await supabase
    .from("email_attachments")
    .select("id")
    .eq("campaign_id", id)
    .eq("user_id", userId);
  const removedIds = ((existingAttachments ?? []) as Array<{ id: string }>)
    .map((row) => row.id)
    .filter((attachmentId) => !newStorageIds.includes(attachmentId));
  if (removedIds.length > 0) {
    await supabase
      .from("email_attachments")
      .update({ campaign_id: null })
      .eq("user_id", userId)
      .in("id", removedIds);
  }
  if (newStorageIds.length > 0) {
    await supabase
      .from("email_attachments")
      .update({ campaign_id: id })
      .eq("user_id", userId)
      .in("id", newStorageIds);
  }

  await insertEvent(supabase, userId, id, "updated", `Kampagne aktualisiert (${rows.length} Empfänger${rejected > 0 ? `, ${rejected} verworfen` : ""}).`);

  revalidatePath("/email-sender");
  revalidatePath(`/email-sender/${id}`);
  return { ok: true, campaignId: id };
}

/* ── Entitlement activation ─────────────────────────────────────────────── */

export async function activateEntitlement(code: string): Promise<EmailSenderActionResult> {
  const ctx = await requireEmailUser();
  if (isActionResult(ctx)) return ctx;
  const { supabase, userId } = ctx;

  const expected = process.env[ACTIVATION_CODE_ENV];
  if (!expected) {
    return {
      ok: false,
      error: "Die Aktivierung ist in dieser Umgebung derzeit nicht verfügbar.",
      code: "activation-unavailable",
    };
  }

  const trimmed = code.trim();
  if (!trimmed || !constantTimeEqual(expected, trimmed)) {
    return { ok: false, error: "Der Aktivierungscode ist ungültig.", code: "activation-invalid" };
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("user_email_entitlements").upsert(
    {
      user_id: userId,
      recipient_limit: PREMIUM_RECIPIENT_LIMIT,
      status: "premium",
      activated_at: now,
    },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/email-sender");
  return { ok: true, message: `Empfängerlimit auf ${PREMIUM_RECIPIENT_LIMIT} erhöht.` };
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/* ── Queue control ──────────────────────────────────────────────────────── */

async function loadCampaign(
  supabase: Supabase,
  userId: string,
  id: string
): Promise<{ campaign: EmailCampaign; recipients: EmailRecipient[] } | EmailSenderActionResult> {
  const { data } = await supabase
    .from("email_campaigns")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Kampagne nicht gefunden.", code: "not-allowed" };
  const { data: recipients } = await supabase
    .from("email_recipients")
    .select("*")
    .eq("campaign_id", id)
    .eq("user_id", userId);
  return { campaign: data as EmailCampaign, recipients: (recipients ?? []) as EmailRecipient[] };
}

function isCampaignLoadError(v: Awaited<ReturnType<typeof loadCampaign>>): v is EmailSenderActionResult {
  return "ok" in v;
}

export async function queueStart(id: string): Promise<EmailSenderActionResult> {
  const ctx = await requireEmailUser();
  if (isActionResult(ctx)) return ctx;
  const { supabase, userId } = ctx;

  const loaded = await loadCampaign(supabase, userId, id);
  if (isCampaignLoadError(loaded)) return loaded;
  const { campaign, recipients } = loaded;

  if (recipients.length === 0) {
    return { ok: false, error: "Die Kampagne hat keine Empfänger.", code: "invalid-input" };
  }

  // Provider gate: without configured Gmail credentials there is nothing to
  // send with — return a clear error instead of faking progress.
  const gmailConfig = getGmailOAuthConfig();
  const { data: connection } = await supabase
    .from("gmail_connections")
    .select("id, rate_limit_reset_at, rate_limit_remaining")
    .eq("user_id", userId)
    .maybeSingle();
  if (!gmailConfig.available || !connection) {
    return {
      ok: false,
      error:
        "Gmail-Anbindung ist nicht konfiguriert. Verbinde zuerst ein Gmail-Konto mit Schreibrecht (Scope: gmail.send) und konfiguriere GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REDIRECT_URI.",
      code: "provider-not-configured",
    };
  }

  // Safe rate-limit handling: refuse to start while a known reset time lies
  // in the future instead of pretending sends happened.
  if (connection.rate_limit_reset_at) {
    const resetAt = new Date(connection.rate_limit_reset_at as string);
    if (resetAt.getTime() > Date.now()) {
      return {
        ok: false,
        error: `Gmail-Rate-Limit aktiv bis ${resetAt.toLocaleString("de-DE")}. Bitte später erneut versuchen.`,
        code: "provider-not-configured",
      };
    }
  }

  if (campaign.status === "sent" || campaign.status === "sending") {
    return { ok: false, error: "Kampagne kann in diesem Zustand nicht gestartet werden.", code: "not-allowed" };
  }

  const { error } = await supabase
    .from("email_campaigns")
    .update({ status: "pending", queue_state: "queued", started_at: new Date().toISOString(), last_error: null })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  await insertEvent(supabase, userId, id, "queued", "Kampagne in Warteschlange eingereiht. Der Versand wird vom Server-Worker übernommen — es wurden noch keine E-Mails gesendet.");

  revalidatePath("/email-sender");
  revalidatePath(`/email-sender/${id}`);
  return {
    ok: true,
    message:
      "Kampagne in Warteschlange eingereiht. Es wurden keine E-Mails gesendet; der Status wird vom Server aktualisiert, sobald der Versand-Worker die Kampagne verarbeitet.",
  };
}

export async function queuePause(id: string): Promise<EmailSenderActionResult> {
  return transitionQueue(id, ["pending", "sending"], "paused", "paused", "paused", "Versand pausiert.");
}

export async function queueResume(id: string): Promise<EmailSenderActionResult> {
  return transitionQueue(id, ["paused"], "pending", "queued", "resumed", "Versand fortgesetzt (in Warteschlange).");
}

export async function queueStop(id: string): Promise<EmailSenderActionResult> {
  return transitionQueue(id, ["pending", "sending", "paused"], "stopped", "stopped", "stopped", "Versand gestoppt.");
}

async function transitionQueue(
  id: string,
  allowedFrom: CampaignStatus[],
  nextStatus: CampaignStatus,
  nextQueue: QueueState,
  eventType: EmailEventType,
  message: string
): Promise<EmailSenderActionResult> {
  const ctx = await requireEmailUser();
  if (isActionResult(ctx)) return ctx;
  const { supabase, userId } = ctx;

  const loaded = await loadCampaign(supabase, userId, id);
  if (isCampaignLoadError(loaded)) return loaded;
  const { campaign } = loaded;

  if (!allowedFrom.includes(campaign.status)) {
    return { ok: false, error: `Nicht möglich im Status „${campaign.status}“.`, code: "not-allowed" };
  }

  const update: Record<string, string> = { status: nextStatus, queue_state: nextQueue };
  if (nextStatus === "stopped") update.finished_at = new Date().toISOString();

  const { error } = await supabase
    .from("email_campaigns")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  await insertEvent(supabase, userId, id, eventType, message);

  revalidatePath("/email-sender");
  revalidatePath(`/email-sender/${id}`);
  return { ok: true, message };
}

/* ── Failure handling ───────────────────────────────────────────────────── */

export async function retryFailed(id: string): Promise<EmailSenderActionResult> {
  const ctx = await requireEmailUser();
  if (isActionResult(ctx)) return ctx;
  const { supabase, userId } = ctx;

  const loaded = await loadCampaign(supabase, userId, id);
  if (isCampaignLoadError(loaded)) return loaded;
  const { campaign, recipients } = loaded;

  if (campaign.status === "sent") {
    return { ok: false, error: "Die Kampagne ist bereits beendet.", code: "not-allowed" };
  }
  const failed = recipients.filter((r) => r.status === "failed");
  if (failed.length === 0) {
    return { ok: false, error: "Keine fehlgeschlagenen Empfänger vorhanden." };
  }

  const { error } = await supabase
    .from("email_recipients")
    .update({ status: "pending", failure_reason: null, rate_limited: false })
    .eq("campaign_id", id)
    .eq("user_id", userId)
    .eq("status", "failed");
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("email_campaigns")
    .update({ status: "pending", queue_state: "queued", failed_count: 0 })
    .eq("id", id)
    .eq("user_id", userId);

  await insertEvent(supabase, userId, id, "retried", `${failed.length} fehlgeschlagene E-Mails erneut eingereiht.`);

  revalidatePath("/email-sender");
  revalidatePath(`/email-sender/${id}`);
  return { ok: true, message: `${failed.length} fehlgeschlagene E-Mails erneut eingereiht.` };
}

export async function removeFailedRecipient(campaignId: string, recipientId: string): Promise<EmailSenderActionResult> {
  const ctx = await requireEmailUser();
  if (isActionResult(ctx)) return ctx;
  const { supabase, userId } = ctx;

  const { data: recipient } = await supabase
    .from("email_recipients")
    .select("id, status")
    .eq("id", recipientId)
    .eq("campaign_id", campaignId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!recipient) return { ok: false, error: "Empfänger nicht gefunden.", code: "not-allowed" };
  if ((recipient.status as RecipientStatus) !== "failed") {
    return { ok: false, error: "Nur fehlgeschlagene Empfänger können entfernt werden.", code: "not-allowed" };
  }

  const { error } = await supabase
    .from("email_recipients")
    .delete()
    .eq("id", recipientId)
    .eq("campaign_id", campaignId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  const { data: campaign } = await supabase
    .from("email_campaigns")
    .select("total_recipients, failed_count")
    .eq("id", campaignId)
    .eq("user_id", userId)
    .maybeSingle();
  if (campaign) {
    await supabase
      .from("email_campaigns")
      .update({
        total_recipients: Math.max(0, (campaign.total_recipients as number) - 1),
        failed_count: Math.max(0, (campaign.failed_count as number) - 1),
      })
      .eq("id", campaignId)
      .eq("user_id", userId);
  }

  revalidatePath("/email-sender");
  revalidatePath(`/email-sender/${campaignId}`);
  return { ok: true };
}

/* ── Export ─────────────────────────────────────────────────────────────── */

export async function exportFailedCsv(id: string): Promise<string | null> {
  const ctx = await requireEmailUser();
  if (isActionResult(ctx)) return null;
  const { supabase, userId } = ctx;

  const { data } = await supabase
    .from("email_recipients")
    .select("email, company, contact_name, failure_reason, updated_at")
    .eq("campaign_id", id)
    .eq("user_id", userId)
    .eq("status", "failed")
    .order("updated_at", { ascending: false });

  const rows = (data ?? []) as Array<{
    email: string;
    company: string | null;
    contact_name: string | null;
    failure_reason: string | null;
    updated_at: string;
  }>;

  const escape = (value: string | null): string => {
    const s = value ?? "";
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [
    "Email;Firma;Kontakt;Fehlergrund;Zeitpunkt",
    ...rows.map((r) =>
      [escape(r.email), escape(r.company), escape(r.contact_name), escape(r.failure_reason), escape(r.updated_at)].join(";")
    ),
  ];
  return lines.join("\n");
}
