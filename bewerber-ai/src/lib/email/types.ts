/**
 * Email Sender — shared type definitions (client + server).
 * Strict TypeScript only; no `any`.
 */

export type CampaignStatus =
  | "draft"
  | "pending"
  | "sending"
  | "paused"
  | "stopped"
  | "sent"
  | "failed";

export type QueueState = "idle" | "queued" | "running" | "paused" | "stopped" | "done";

export type RecipientStatus = "pending" | "sending" | "sent" | "failed";

export type EmailEventType =
  | "created"
  | "updated"
  | "queued"
  | "started"
  | "paused"
  | "resumed"
  | "stopped"
  | "recipient_sent"
  | "recipient_failed"
  | "retried"
  | "completed";

export type EntitlementStatus = "standard" | "premium";

export interface AttachmentMeta {
  name: string;
  size: number;
  type: string;
  /**
   * Id of the server-side stored bytes (email_attachments). Present only
   * after the file was uploaded to the server. Bytes never live in the
   * browser — drafts keep metadata only.
   */
  storage_id?: string | null;
}

export interface EmailCampaign {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  body_html: string;
  body_text: string;
  status: CampaignStatus;
  queue_state: QueueState;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  attachments: AttachmentMeta[];
  last_error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailRecipient {
  id: string;
  campaign_id: string;
  user_id: string;
  email: string;
  company: string | null;
  contact_name: string | null;
  status: RecipientStatus;
  failure_reason: string | null;
  rate_limited: boolean;
  sent_at: string | null;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  /** Delivery attempts (server worker). Optional for pre-migration rows. */
  attempts?: number;
  /** Next allowed delivery attempt (exponential backoff). */
  next_attempt_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailEvent {
  id: string;
  campaign_id: string;
  user_id: string;
  recipient_id: string | null;
  event_type: EmailEventType;
  message: string | null;
  created_at: string;
}

export interface GmailConnectionInfo {
  id: string;
  user_id: string;
  email: string | null;
  provider_account_id: string | null;
  scope: string | null;
  token_expires_at: string | null;
  rate_limit_remaining: number | null;
  rate_limit_reset_at: string | null;
  connected_at: string;
  updated_at: string;
  /** Present only when server-side code explicitly selects it. */
  encrypted_tokens?: string;
}

export interface UserEmailEntitlement {
  id: string;
  user_id: string;
  recipient_limit: number;
  status: EntitlementStatus;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailReply {
  id: string;
  campaign_id: string | null;
  user_id: string;
  thread_id: string | null;
  /** Gmail message id of the reply (dedup key with user_id). */
  gmail_message_id: string | null;
  from_email: string | null;
  subject: string | null;
  body_text: string | null;
  received_at: string | null;
  is_read: boolean;
  created_at: string;
}

/** Draft recipient row used by the client (before persisting to DB). */
export interface DraftRecipient {
  email: string;
  company: string;
  contact_name: string;
  status: "valid" | "invalid";
}

/** Draft content persisted to localStorage (never OAuth tokens). */
export interface CampaignDraft {
  title: string;
  subject: string;
  bodyHtml: string;
  recipients: DraftRecipient[];
  attachments: AttachmentMeta[];
  savedAt: string | null;
}

export interface CampaignMetrics {
  total: number;
  sent: number;
  failed: number;
  remaining: number;
  progressPercent: number;
}

export interface CampaignWithMetrics extends EmailCampaign {
  metrics: CampaignMetrics;
}

export interface CampaignDetail {
  campaign: CampaignWithMetrics;
  recipients: EmailRecipient[];
  events: EmailEvent[];
}

export interface GmailStatus {
  /** Credentials present in env (GMAIL_CLIENT_ID/SECRET/REDIRECT_URI). */
  available: boolean;
  connected: boolean;
  email: string | null;
  scope: string | null;
}

export interface DashboardState {
  campaigns: CampaignWithMetrics[];
  running: CampaignWithMetrics | null;
  failedRecipients: EmailRecipient[];
  replies: EmailReply[];
  entitlement: {
    limit: number;
    status: EntitlementStatus;
    activatedAt: string | null;
  };
  dailySent: number;
  gmail: GmailStatus;
}

export type EmailSenderActionErrorCode =
  | "provider-not-configured"
  | "not-authenticated"
  | "invalid-input"
  | "activation-unavailable"
  | "activation-invalid"
  | "not-allowed";

export type EmailSenderActionResult =
  | { ok: true; campaignId?: string; message?: string }
  | { ok: false; error: string; code?: EmailSenderActionErrorCode };

export interface CampaignRecipientInput {
  email: string;
  company?: string | null;
  contact_name?: string | null;
}

export interface CreateCampaignInput {
  title: string;
  subject: string;
  body_html: string;
  body_text: string;
  recipients: CampaignRecipientInput[];
  attachments: AttachmentMeta[];
}

export type UpdateCampaignInput = CreateCampaignInput;
