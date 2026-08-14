/**
 * Gmail OAuth boundary (server-side only).
 * - Builds the Google authorization URL with gmail.send plus the minimum read
 *   scope needed for real reply discovery on app-sent threads (gmail.metadata:
 *   headers + snippet only, never bodies/attachments of unrelated mail).
 * - Exchanges the authorization code for tokens (never stored in the browser).
 * - Actual Gmail calls happen only in the delivery worker (./worker.ts,
 *   ./gmail-api.ts) at runtime once credentials are configured.
 */
import type { GmailStatus } from "./types";

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
/** Minimum read scope for reply discovery (metadata only). */
export const GMAIL_METADATA_SCOPE = "https://www.googleapis.com/auth/gmail.metadata";
/** Space-joined scope set used for the authorization request. */
export const GMAIL_SCOPES = `${GMAIL_SEND_SCOPE} ${GMAIL_METADATA_SCOPE}`;

export interface GmailOAuthConfig {
  available: boolean;
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string | null;
}

export function getGmailOAuthConfig(): GmailOAuthConfig {
  const clientId = process.env.GMAIL_CLIENT_ID ?? null;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET ?? null;
  const redirectUri = process.env.GMAIL_REDIRECT_URI ?? null;
  return {
    available: Boolean(clientId && clientSecret && redirectUri),
    clientId,
    clientSecret,
    redirectUri,
  };
}

export function buildAuthorizationUrl(state: string): string | null {
  const config = getGmailOAuthConfig();
  if (!config.available || !config.clientId || !config.redirectUri) return null;
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GmailTokenPayload {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expires_in?: number;
  id_token?: string;
}

export interface ExchangedToken {
  accessToken: string;
  refreshToken: string | null;
  scope: string;
  expiresAt: string | null;
  providerAccountId: string | null;
  email: string | null;
}

/**
 * Exchanges an authorization code for tokens via Google's token endpoint.
 * Called only by the OAuth callback route at runtime.
 */
export async function exchangeAuthorizationCode(
  code: string,
  config: GmailOAuthConfig
): Promise<ExchangedToken> {
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error("Gmail-OAuth ist nicht vollständig konfiguriert.");
  }
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) {
    throw new Error(`Gmail-Token-Austausch fehlgeschlagen (HTTP ${response.status}).`);
  }
  const payload = (await response.json()) as GmailTokenPayload;
  if (!payload.access_token) {
    throw new Error("Gmail-Token-Antwort enthält kein access_token.");
  }

  const idClaims = decodeIdToken(payload.id_token);
  const now = Date.now();
  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : null;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    scope: payload.scope ?? GMAIL_SEND_SCOPE,
    expiresAt: expiresIn ? new Date(now + expiresIn * 1000).toISOString() : null,
    providerAccountId: idClaims?.sub ?? null,
    email: idClaims?.email ?? null,
  };
}

/** Decodes the id_token JWT payload locally (no network). */
function decodeIdToken(idToken: string | undefined): { sub?: string; email?: string } | null {
  if (!idToken) return null;
  const parts = idToken.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json) as { sub?: string; email?: string };
    return parsed;
  } catch {
    return null;
  }
}

/** Whether tokens can be safely stored (encryption key present). */
export function canStoreTokens(): boolean {
  return Boolean(process.env.EMAIL_TOKEN_ENCRYPTION_KEY);
}

export function buildGmailStatus(connected: boolean, email: string | null, scope: string | null): GmailStatus {
  return {
    available: getGmailOAuthConfig().available,
    connected,
    email,
    scope,
  };
}
