import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { runDeliveryForUser } from "@/lib/email/worker";
import { DeliveryError } from "@/lib/email/worker-core";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

/**
 * Delivery worker trigger.
 *
 * Two modes:
 *  1. Session mode (default): processes the queue of the signed-in user.
 *  2. Service mode (optional, for unattended/cron scheduling): requires BOTH
 *     SUPABASE_SERVICE_ROLE_KEY and EMAIL_SENDER_WORKER_TOKEN env vars, and an
 *     `Authorization: Bearer <EMAIL_SENDER_WORKER_TOKEN>` header. Without
 *     those env vars the service mode is inert.
 *
 * Honesty: this route never claims sends — it only reports what the provider
 * actually confirmed. If Gmail is not configured/connected, nothing is sent.
 */
export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const workerToken = process.env.EMAIL_SENDER_WORKER_TOKEN;
  const authorization = request.headers.get("authorization") ?? "";

  if (serviceKey && workerToken && authorization === `Bearer ${workerToken}`) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return json({ ok: false, error: "Supabase-URL fehlt." }, 500);
    const admin = createSupabaseJsClient(url, serviceKey);

    const { data } = await admin
      .from("email_campaigns")
      .select("user_id")
      .in("status", ["pending", "sending"])
      .in("queue_state", ["queued", "running"]);
    const userIds = Array.from(
      new Set(((data ?? []) as Array<{ user_id: string }>).map((row) => row.user_id))
    ).slice(0, 50);

    const results: Array<Record<string, unknown>> = [];
    for (const userId of userIds) {
      try {
        results.push({ userId, ...(await runDeliveryForUser(admin, userId)) });
      } catch (error) {
        results.push({ userId, error: error instanceof Error ? error.message : "unknown" });
      }
    }
    return json({ ok: true, mode: "service", users: userIds.length, results });
  }

  const supabase = await createServerClient();
  if (!supabase) return json({ ok: false, error: "Supabase nicht konfiguriert." }, 500);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ ok: false, error: "Nicht angemeldet." }, 401);

  try {
    const result = await runDeliveryForUser(supabase, user.id);
    return json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof DeliveryError) {
      return json({ ok: false, error: error.message });
    }
    const message = error instanceof Error ? error.message : "Worker-Fehler.";
    return json({ ok: false, error: message }, 500);
  }
}
