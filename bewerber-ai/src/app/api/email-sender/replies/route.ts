import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { syncRepliesForUser } from "@/lib/email/worker";
import { DeliveryError } from "@/lib/email/worker-core";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

/**
 * Reply sync trigger (session-authenticated).
 * Fetches only threads of app-sent messages (gmail.metadata scope) and stores
 * replies from other senders. Never touches unrelated mail.
 */
export async function POST() {
  const supabase = await createServerClient();
  if (!supabase) return json({ ok: false, error: "Supabase nicht konfiguriert." }, 500);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ ok: false, error: "Nicht angemeldet." }, 401);

  try {
    const result = await syncRepliesForUser(supabase, user.id);
    return json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof DeliveryError) {
      return json({ ok: false, error: error.message });
    }
    const message = error instanceof Error ? error.message : "Antwort-Sync fehlgeschlagen.";
    return json({ ok: false, error: message }, 500);
  }
}
