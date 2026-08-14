import { NextResponse } from "next/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);
const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "jpg", "jpeg", "png"]);
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 18 * 1024 * 1024; // total under Gmail's 25 MB message limit

function guessMimeType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    default:
      return "";
  }
}

/**
 * Server-side attachment upload.
 * Stores the file bytes ONLY in the database (email_attachments.content_b64);
 * the browser keeps metadata (id/name/size/type) and never stores bytes.
 * Validation is enforced server-side (types, per-file and total size, count).
 *
 * Privacy: since migration 005, authenticated clients have NO SELECT policy
 * on email_attachments. All writes and the metadata response therefore run
 * through the server-side service-role client (env-only key, never exposed).
 * If the service key is missing, the upload fails honestly (500) instead of
 * silently degrading.
 */
export async function POST(request: Request) {
  const supabase = await createServerClient();
  if (!supabase) return json({ ok: false, error: "Supabase nicht konfiguriert." }, 500);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ ok: false, error: "Nicht angemeldet." }, 401);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return json({ ok: false, error: "Server-Zugriff auf den Anhangspeicher ist nicht konfiguriert." }, 500);
  }
  // Service-role client for attachment storage (bypasses RLS; the service key
  // is read from env on the server and never reaches the browser).
  const admin = createSupabaseJsClient(url, serviceKey);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "Ungültiges Formular." }, 400);
  }

  const files = form.getAll("files").filter((value): value is File => value instanceof File);
  if (files.length === 0) return json({ ok: false, error: "Keine Dateien übermittelt." }, 400);
  if (files.length > MAX_FILES) return json({ ok: false, error: `Maximal ${MAX_FILES} Anhänge.` }, 400);

  for (const file of files) {
    const mimeType = file.type || guessMimeType(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_TYPES.has(mimeType) || !ALLOWED_EXTENSIONS.has(ext)) {
      return json({ ok: false, error: `Nicht unterstützter Dateityp: ${file.name}.` }, 400);
    }
    if (file.size > MAX_FILE_BYTES) {
      return json({ ok: false, error: `${file.name} überschreitet das Limit von 10 MB.` }, 400);
    }
  }
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return json({ ok: false, error: "Gesamtgröße überschreitet 18 MB." }, 400);
  }

  // Remove orphaned uploads (never attached to a campaign, older than 24 h).
  // Done via the service-role client (no authenticated SELECT/UPDATE policy
  // remains on email_attachments after migration 005).
  await admin
    .from("email_attachments")
    .delete()
    .eq("user_id", user.id)
    .is("campaign_id", null)
    .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const stored: Array<{ storage_id: string; name: string; size: number; type: string }> = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = file.type || guessMimeType(file.name);
    // Write + metadata response via service-role. Only metadata columns are
    // selected/returned — content_b64 never leaves the server.
    const { data, error } = await admin
      .from("email_attachments")
      .insert({
        user_id: user.id,
        name: file.name,
        mime_type: mimeType,
        size_bytes: file.size,
        content_b64: Buffer.from(bytes).toString("base64"),
      })
      .select("id, name, mime_type, size_bytes")
      .single();
    if (error || !data) {
      return json({ ok: false, error: error?.message ?? "Speichern fehlgeschlagen." }, 500);
    }
    stored.push({
      storage_id: (data as { id: string }).id,
      name: (data as { name: string }).name,
      size: (data as { size_bytes: number }).size_bytes,
      type: (data as { mime_type: string }).mime_type,
    });
  }

  return json({ ok: true, attachments: stored });
}
