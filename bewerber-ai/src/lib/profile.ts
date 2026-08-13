"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  Education,
  Experience,
  Language,
  Profile,
  Skill,
} from "@/lib/db";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export interface FullProfile {
  profile: Profile | null;
  education: Education[];
  experience: Experience[];
  languages: Language[];
  skills: Skill[];
}

function noEnv(): ActionResult {
  return { ok: false, error: "Supabase ist nicht konfiguriert. Setze NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY." };
}

async function requireUserId(): Promise<{ supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>; userId: string } | ActionResult> {
  const supabase = await createClient();
  if (!supabase) return noEnv();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, error: "Nicht angemeldet." };
  }
  return { supabase, userId: data.user.id };
}

function isActionResult(v: unknown): v is ActionResult {
  return typeof v === "object" && v !== null && "ok" in v;
}

export async function getFullProfile(): Promise<FullProfile> {
  const auth = await requireUserId();
  if (isActionResult(auth)) {
    return { profile: null, education: [], experience: [], languages: [], skills: [] };
  }
  const { supabase, userId } = auth;

  const [profileRes, educationRes, experienceRes, languagesRes, skillsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("education").select("*").eq("user_id", userId).order("start_date", { ascending: false, nullsFirst: false }),
    supabase.from("experience").select("*").eq("user_id", userId).order("start_date", { ascending: false, nullsFirst: false }),
    supabase.from("languages").select("*").eq("user_id", userId).order("name"),
    supabase.from("skills").select("*").eq("user_id", userId).order("level", { ascending: false }),
  ]);

  return {
    profile: profileRes.data as Profile | null,
    education: (educationRes.data ?? []) as Education[],
    experience: (experienceRes.data ?? []) as Experience[],
    languages: (languagesRes.data ?? []) as Language[],
    skills: (skillsRes.data ?? []) as Skill[],
  };
}

export async function upsertProfile(patch: Partial<Profile>): Promise<ActionResult> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return auth;
  const { supabase, userId } = auth;

  const { error } = await supabase.from("profiles").upsert(
    { user_id: userId, ...patch, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function saveOnboardingStep(step: number, patch: Partial<Profile>): Promise<ActionResult> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return auth;
  const { supabase, userId } = auth;

  const { error } = await supabase.from("profiles").upsert(
    { user_id: userId, ...patch, onboarding_step: step, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function completeOnboarding(): Promise<ActionResult> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return auth;
  const { supabase, userId } = auth;

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true, onboarding_step: 6, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return { ok: true };
}

/* ── Education ─────────────────────────────────────────────── */

export async function addEducation(input: Omit<Education, "id" | "user_id" | "created_at" | "updated_at">): Promise<ActionResult> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return auth;
  const { supabase, userId } = auth;
  const { error } = await supabase.from("education").insert({ ...input, user_id: userId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function deleteEducation(id: string): Promise<ActionResult> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return auth;
  const { supabase, userId } = auth;
  const { error } = await supabase.from("education").delete().eq("id", id).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  revalidatePath("/onboarding");
  return { ok: true };
}

/* ── Experience ────────────────────────────────────────────── */

export async function addExperience(input: Omit<Experience, "id" | "user_id" | "created_at" | "updated_at">): Promise<ActionResult> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return auth;
  const { supabase, userId } = auth;
  const { error } = await supabase.from("experience").insert({ ...input, user_id: userId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function deleteExperience(id: string): Promise<ActionResult> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return auth;
  const { supabase, userId } = auth;
  const { error } = await supabase.from("experience").delete().eq("id", id).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  revalidatePath("/onboarding");
  return { ok: true };
}

/* ── Languages ─────────────────────────────────────────────── */

export async function addLanguage(input: { name: string; level: string }): Promise<ActionResult> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return auth;
  const { supabase, userId } = auth;
  const { error } = await supabase.from("languages").insert({ ...input, user_id: userId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function deleteLanguage(id: string): Promise<ActionResult> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return auth;
  const { supabase, userId } = auth;
  const { error } = await supabase.from("languages").delete().eq("id", id).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  revalidatePath("/onboarding");
  return { ok: true };
}

/* ── Skills ────────────────────────────────────────────────── */

export async function addSkill(input: { name: string; level: number }): Promise<ActionResult> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return auth;
  const { supabase, userId } = auth;
  const { error } = await supabase.from("skills").insert({ ...input, user_id: userId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function deleteSkill(id: string): Promise<ActionResult> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return auth;
  const { supabase, userId } = auth;
  const { error } = await supabase.from("skills").delete().eq("id", id).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  revalidatePath("/onboarding");
  return { ok: true };
}
