/**
 * Gmail REST API client (server-side only).
 *
 * - Refreshes the OAuth access token from the encrypted refresh token stored
 *   in gmail_connections (never exposed to the browser).
 * - Sends one message at a time via POST /gmail/v1/users/me/messages/send.
 * - Fetches thread metadata (format=metadata) for reply discovery — used only
 *   for threads of app-sent messages.
 *
 * HTTP failures are classified into permanent vs. temporary so the worker can
 * decide between `failed` and exponential-backoff retry.
 */
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { decryptJson, encryptJson } from "./crypto";
import { getGmailOAuthConfig } from "./gmail";
import { DeliveryError } from "./worker-core";

export interface StoredTokens {
  access_token: string;
  refresh_token?: string | null;
  scope?: string;
  expires_at?: string | null;
}

export interface SentMessageResponse {
  id: string;
  threadId: string;
}

export interface ThreadMessage {
  id: string;
  threadId: string;
  internalDate: string | null;
  snippet: string;
  labelIds: string[];
  headers: Array<{ name: string; value: string }>;
}

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me";

/* ── Access token handling ───────────────────────────────────────────────── */

async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in?: number; scope?: string }> {
  const config = getGmailOAuthConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new DeliveryError("Gmail-OAuth ist nicht vollständig konfiguriert.", { temporary: false });
  }
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });
  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch {
    throw new DeliveryError("Gmail-Token-Refresh: Netzwerkfehler.", { temporary: true });
  }
  if (!response.ok) {
    const temporary = response.status === 429 || response.status >= 500;
    throw new DeliveryError(`Gmail-Token-Refresh fehlgeschlagen (HTTP ${response.status}).`, {
      temporary,
    });
  }
  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!payload.access_token) {
    throw new DeliveryError("Gmail-Token-Refresh: Antwort ohne access_token.", { temporary: false });
  }
  return {
    access_token: payload.access_token,
    expires_in: payload.expires_in,
    scope: payload.scope,
  };
}

/**
 * Returns a valid access token for the user, refreshing and re-encrypting the
 * stored tokens when necessary. Throws DeliveryError when no connection exists
 * or the refresh token was revoked (permanent).
 */
export async function getAccessTokenForUser(
  supabase: SupabaseServerClient,
  userId: string
): Promise<string> {
  const { data: connection } = await supabase
    .from("gmail_connections")
    .select("id, email, encrypted_tokens, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!connection?.encrypted_tokens) {
    throw new DeliveryError("Kein Gmail-Konto verbunden — bitte zuerst verbinden.", {
      temporary: false,
    });
  }

  const tokens = await decryptJson<StoredTokens>(connection.encrypted_tokens);
  if (!tokens.access_token) {
    throw new DeliveryError("Gespeichertes Gmail-Token ist unbrauchbar — bitte erneut verbinden.", {
      temporary: false,
    });
  }

  const expiresAt = tokens.expires_at ? Date.parse(tokens.expires_at) : NaN;
  const stillValid = Number.isFinite(expiresAt) && expiresAt - Date.now() > 60_000;
  if (stillValid) return tokens.access_token;

  if (!tokens.refresh_token) {
    throw new DeliveryError("Kein Gmail-Refresh-Token vorhanden — bitte erneut verbinden.", {
      temporary: false,
    });
  }

  const refreshed = await refreshAccessToken(tokens.refresh_token);
  const nextTokens: StoredTokens = {
    access_token: refreshed.access_token,
    refresh_token: tokens.refresh_token,
    scope: refreshed.scope ?? tokens.scope,
    expires_at: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString(),
  };
  const ciphertext = await encryptJson(nextTokens);
  await supabase
    .from("gmail_connections")
    .update({ encrypted_tokens: ciphertext, token_expires_at: nextTokens.expires_at })
    .eq("user_id", userId);

  return refreshed.access_token;
}

/* ── Gmail API calls ─────────────────────────────────────────────────────── */

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  return null;
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

function classifyHttpError(status: number, detail: string, retryAfter: number | null): DeliveryError {
  const temporary = status === 429 || status >= 500 || status === 401;
  const suffix = retryAfter ? ` (Retry-After: ${retryAfter}s)` : "";
  return new DeliveryError(`Gmail-API-Fehler: ${detail}${suffix}`, {
    temporary,
    retryAfterSec: status === 429 ? retryAfter : null,
  });
}

/** Sends a single pre-built MIME message (base64url `raw`). */
export async function sendGmailMessage(
  accessToken: string,
  raw: string
): Promise<SentMessageResponse> {
  let response: Response;
  try {
    response = await fetch(`${GMAIL_ENDPOINT}/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
  } catch {
    throw new DeliveryError("Gmail send: Netzwerkfehler.", { temporary: true });
  }

  if (!response.ok) {
    const detail = await readErrorBody(response);
    const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
    throw classifyHttpError(response.status, detail, retryAfter);
  }

  const payload = (await response.json()) as { id?: string; threadId?: string };
  if (!payload.id) {
    throw new DeliveryError("Gmail send: Antwort ohne Nachrichten-ID.", { temporary: true });
  }
  return { id: payload.id, threadId: payload.threadId ?? payload.id };
}

interface GmailThreadPayload {
  messages?: Array<{
    id?: string;
    threadId?: string;
    internalDate?: string;
    snippet?: string;
    labelIds?: string[];
    payload?: { headers?: Array<{ name?: string; value?: string }> };
  }>;
}

/** Fetches one thread's messages (metadata format — headers + snippet only). */
export async function fetchThreadMessages(
  accessToken: string,
  threadId: string
): Promise<ThreadMessage[]> {
  let response: Response;
  try {
    response = await fetch(
      `${GMAIL_ENDPOINT}/threads/${encodeURIComponent(threadId)}?format=metadata`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
  } catch {
    throw new DeliveryError("Gmail threads: Netzwerkfehler.", { temporary: true });
  }

  if (!response.ok) {
    const detail = await readErrorBody(response);
    const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
    throw classifyHttpError(response.status, detail, retryAfter);
  }

  const payload = (await response.json()) as GmailThreadPayload;
  return (payload.messages ?? []).map((message) => ({
    id: message.id ?? "",
    threadId: message.threadId ?? threadId,
    internalDate: message.internalDate ?? null,
    snippet: message.snippet ?? "",
    labelIds: message.labelIds ?? [],
    headers: (message.payload?.headers ?? []).map((h) => ({
      name: h.name ?? "",
      value: h.value ?? "",
    })),
  }));
}
