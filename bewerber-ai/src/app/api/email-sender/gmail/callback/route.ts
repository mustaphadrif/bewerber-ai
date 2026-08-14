import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { exchangeAuthorizationCode, getGmailOAuthConfig, canStoreTokens } from "@/lib/email/gmail";
import { encryptJson } from "@/lib/email/crypto";

export const dynamic = "force-dynamic";

/**
 * Gmail OAuth callback — server-side token boundary.
 * Exchanges the authorization code, encrypts the tokens with AES-GCM
 * (EMAIL_TOKEN_ENCRYPTION_KEY) and stores ONLY the ciphertext in Supabase.
 * Tokens never reach the browser. The granted scope set is gmail.send +
 * gmail.metadata (minimal read scope for reply discovery on app-sent threads);
 * the callback stores the scope string exactly as granted by Google.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("es_gmail_state")?.value ?? null;
  cookieStore.set("es_gmail_state", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });

  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/email-sender?gmail=error&reason=${encodeURIComponent(reason)}`);

  if (oauthError) return fail(`oauth:${oauthError}`);
  if (!code) return fail("missing-code");
  if (!state || !expectedState || state !== expectedState) return fail("state-mismatch");

  const config = getGmailOAuthConfig();
  if (!config.available) return fail("unavailable");
  if (!canStoreTokens()) return fail("encryption-key-missing");

  try {
    const exchanged = await exchangeAuthorizationCode(code, config);
    const ciphertext = await encryptJson({
      access_token: exchanged.accessToken,
      refresh_token: exchanged.refreshToken,
      scope: exchanged.scope,
      expires_at: exchanged.expiresAt,
    });

    const supabase = await createClient();
    if (!supabase) return fail("supabase-unavailable");

    const { error } = await supabase.from("gmail_connections").upsert(
      {
        user_id: user.id,
        email: exchanged.email,
        provider_account_id: exchanged.providerAccountId,
        scope: exchanged.scope,
        encrypted_tokens: ciphertext,
        token_expires_at: exchanged.expiresAt,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) return fail(`db:${error.message}`);

    return NextResponse.redirect(`${origin}/email-sender?gmail=connected`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return fail(`exchange:${message}`);
  }
}
