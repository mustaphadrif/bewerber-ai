"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CvDocument, Json } from "@/lib/db";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

async function requireUserId(): Promise<
  | { supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>; userId: string }
  | ActionResult
> {
  const supabase = await createClient();
  if (!supabase) {
    return { ok: false, error: "Supabase ist nicht konfiguriert." };
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, error: "Nicht angemeldet." };
  return { supabase, userId: data.user.id };
}

function isActionResult(v: unknown): v is ActionResult {
  return typeof v === "object" && v !== null && "ok" in v;
}

export async function listCvDocuments(): Promise<CvDocument[]> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return [];
  const { supabase, userId } = auth;
  const { data, error } = await supabase
    .from("cv_documents")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as CvDocument[];
}

export async function saveCvDocument(input: {
  title: string;
  template: string;
  font_size: number;
  accent_color: string;
  include_photo: boolean;
  content: Json;
}): Promise<ActionResult> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return auth;
  const { supabase, userId } = auth;

  const { data, error } = await supabase
    .from("cv_documents")
    .insert({ ...input, user_id: userId })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/lebenslauf");
  return { ok: true, id: data.id };
}

export async function deleteCvDocument(id: string): Promise<ActionResult> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return auth;
  const { supabase, userId } = auth;
  const { error } = await supabase.from("cv_documents").delete().eq("id", id).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/lebenslauf");
  return { ok: true };
}
