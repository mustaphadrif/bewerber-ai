"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateCoverLetter, type GenerateCoverLetterInput, type VerifiedProfileForLetter } from "@/lib/ai";
import type { CoverLetter } from "@/lib/db";

export type ActionResult = { ok: true; content?: string; model?: string } | { ok: false; error: string; code?: "no-credential" | "provider-error" | "invalid-input" };

async function requireVerifiedProfile(): Promise<
  { supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>; userId: string; profile: VerifiedProfileForLetter } | ActionResult
> {
  const supabase = await createClient();
  if (!supabase) {
    return { ok: false, error: "Supabase ist nicht konfiguriert." };
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, error: "Nicht angemeldet." };
  const userId = data.user.id;

  const [profileRes, expRes, eduRes, skillRes, langRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("experience").select("*").eq("user_id", userId).order("start_date", { ascending: false, nullsFirst: false }),
    supabase.from("education").select("*").eq("user_id", userId).order("end_date", { ascending: false, nullsFirst: false }),
    supabase.from("skills").select("*").eq("user_id", userId).order("level", { ascending: false }),
    supabase.from("languages").select("*").eq("user_id", userId).order("name"),
  ]);

  const p = profileRes.data as { first_name: string | null; last_name: string | null; headline: string | null; about: string | null; email: string | null; phone: string | null; city: string | null } | null;

  const profile: VerifiedProfileForLetter = {
    fullName: [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Bewerber",
    headline: p?.headline ?? "",
    about: p?.about ?? "",
    email: p?.email ?? null,
    phone: p?.phone ?? null,
    city: p?.city ?? null,
    experience: ((expRes.data ?? []) as Array<{ company: string; position: string; start_date: string | null; end_date: string | null; current: boolean; description: string | null }>).map((e) => ({
      company: e.company,
      position: e.position,
      start: e.start_date,
      end: e.end_date,
      current: e.current,
      description: e.description,
    })),
    education: ((eduRes.data ?? []) as Array<{ institution: string; degree: string | null; field_of_study: string | null; end_date: string | null }>).map((e) => ({
      institution: e.institution,
      degree: e.degree,
      field: e.field_of_study,
      end: e.end_date,
    })),
    skills: ((skillRes.data ?? []) as Array<{ name: string }>).map((s) => s.name),
    languages: ((langRes.data ?? []) as Array<{ name: string; level: string }>).map((l) => `${l.name} (${l.level})`),
  };

  return { supabase, userId, profile };
}

function isActionResult(v: Awaited<ReturnType<typeof requireVerifiedProfile>>): v is ActionResult {
  return "ok" in v;
}

export async function generateCoverLetterAction(input: GenerateCoverLetterInput): Promise<ActionResult> {
  const ctx = await requireVerifiedProfile();
  if (isActionResult(ctx)) return ctx;
  const { supabase, userId, profile } = ctx;

  if (!input.companyName.trim() || !input.jobTitle.trim()) {
    return { ok: false, error: "Unternehmen und Position sind erforderlich.", code: "invalid-input" };
  }

  const result = await generateCoverLetter(profile, input);
  if (!result.ok) return { ok: false, error: result.error, code: result.code };

  const { error } = await supabase.from("cover_letters").insert({
    user_id: userId,
    company_name: input.companyName.trim(),
    job_title: input.jobTitle.trim(),
    recipient_name: input.recipientName?.trim() || null,
    content: result.content,
    generated_by: `ki-${result.model}`,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/anschreiben");
  return { ok: true, content: result.content, model: result.model };
}

export async function saveCoverLetterManually(input: {
  company_name: string;
  job_title: string;
  recipient_name?: string | null;
  content: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Supabase ist nicht konfiguriert." };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, error: "Nicht angemeldet." };

  if (!input.company_name.trim() || !input.job_title.trim() || !input.content.trim()) {
    return { ok: false, error: "Unternehmen, Position und Text sind erforderlich." };
  }

  const { error: insertError } = await supabase.from("cover_letters").insert({
    user_id: data.user.id,
    company_name: input.company_name.trim(),
    job_title: input.job_title.trim(),
    recipient_name: input.recipient_name?.trim() || null,
    content: input.content,
    generated_by: "manuell",
  });
  if (insertError) return { ok: false, error: insertError.message };
  revalidatePath("/anschreiben");
  return { ok: true };
}

export async function listCoverLetters(): Promise<CoverLetter[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return [];
  const { data: letters, error: listError } = await supabase
    .from("cover_letters")
    .select("*")
    .eq("user_id", data.user.id)
    .order("created_at", { ascending: false });
  if (listError) return [];
  return (letters ?? []) as CoverLetter[];
}

export async function deleteCoverLetter(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: "Supabase ist nicht konfiguriert." };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, error: "Nicht angemeldet." };
  const { error: deleteError } = await supabase
    .from("cover_letters")
    .delete()
    .eq("id", id)
    .eq("user_id", data.user.id);
  if (deleteError) return { ok: false, error: deleteError.message };
  revalidatePath("/anschreiben");
  return { ok: true };
}
