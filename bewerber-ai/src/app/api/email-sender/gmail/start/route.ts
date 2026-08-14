import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/supabase/server";
import { buildAuthorizationUrl, getGmailOAuthConfig } from "@/lib/email/gmail";

export const dynamic = "force-dynamic";

/**
 * Gmail OAuth start (separate from app login).
 * Builds the Google authorization URL with gmail.send + the minimal read
 * scope gmail.metadata (reply discovery on app-sent threads) and stores a
 * short-lived CSRF state cookie. When credentials are missing the user is
 * redirected back to a safe "unavailable" state.
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const config = getGmailOAuthConfig();
  if (!config.available) {
    return NextResponse.redirect(`${origin}/email-sender?gmail=unavailable`);
  }

  const state = randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("es_gmail_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 600,
    path: "/",
  });

  const authorizationUrl = buildAuthorizationUrl(state);
  if (!authorizationUrl) {
    return NextResponse.redirect(`${origin}/email-sender?gmail=unavailable`);
  }

  return NextResponse.redirect(authorizationUrl);
}
