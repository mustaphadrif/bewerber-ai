"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Application, ApplicationStatus, ApplicationEvent } from "@/lib/db";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

type RequireUserResult =
  | { supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>; userId: string }
  | ActionResult;

async function requireUserId(): Promise<RequireUserResult> {
  const supabase = await createClient();
  if (!supabase) {
    return { ok: false, error: "Supabase ist nicht konfiguriert. Setze NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY." };
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, error: "Nicht angemeldet." };
  return { supabase, userId: data.user.id };
}

function isActionResult(v: RequireUserResult): v is ActionResult {
  return "ok" in v;
}

export interface ApplicationWithCompany extends Application {
  company: { id: string; name: string; logo_url: string | null } | null;
}

export async function listApplications(filter?: {
  status?: ApplicationStatus | "alle";
  search?: string;
}): Promise<ApplicationWithCompany[]> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return [];
  const { supabase, userId } = auth;

  let query = supabase
    .from("applications")
    .select("*, company:companies(id, name, logo_url)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (filter?.status && filter.status !== "alle") {
    query = query.eq("status", filter.status);
  }
  if (filter?.search) {
    query = query.ilike("company_name", `%${filter.search}%`);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as ApplicationWithCompany[];
}

export async function getApplication(id: string): Promise<{
  application: ApplicationWithCompany | null;
  events: ApplicationEvent[];
}> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return { application: null, events: [] };
  const { supabase, userId } = auth;

  const { data: appData } = await supabase
    .from("applications")
    .select("*, company:companies(id, name, logo_url)")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!appData) return { application: null, events: [] };

  const { data: events } = await supabase
    .from("application_events")
    .select("*")
    .eq("application_id", id)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  return { application: appData as ApplicationWithCompany, events: (events ?? []) as ApplicationEvent[] };
}

export async function createApplication(
  input: Pick<Application, "company_id" | "company_name" | "job_title" | "status" | "location" | "salary_range" | "job_url" | "notes" | "applied_at" | "next_step_at">
): Promise<ActionResult & { id?: string }> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return auth;
  const { supabase, userId } = auth;

  const { data, error } = await supabase
    .from("applications")
    .insert({ ...input, user_id: userId })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  // Initial timeline event
  await supabase.from("application_events").insert({
    application_id: data.id,
    user_id: userId,
    status_from: null,
    status_to: input.status,
    note: "Bewerbung angelegt",
  });

  revalidatePath("/bewerbungen");
  revalidatePath("/dashboard");
  return { ok: true, id: data.id };
}

export async function updateApplication(
  id: string,
  input: Partial<Pick<Application, "status" | "location" | "salary_range" | "job_url" | "notes" | "applied_at" | "next_step_at">>
): Promise<ActionResult> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return auth;
  const { supabase, userId } = auth;

  const { data: current } = await supabase
    .from("applications")
    .select("status")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase
    .from("applications")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };

  if (input.status && current && current.status !== input.status) {
    await supabase.from("application_events").insert({
      application_id: id,
      user_id: userId,
      status_from: current.status as ApplicationStatus,
      status_to: input.status,
      note: null,
    });
  }

  revalidatePath("/bewerbungen");
  revalidatePath(`/bewerbungen/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteApplication(id: string): Promise<ActionResult> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return auth;
  const { supabase, userId } = auth;
  const { error } = await supabase
    .from("applications")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/bewerbungen");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function addApplicationNote(id: string, note: string): Promise<ActionResult> {
  const auth = await requireUserId();
  if (isActionResult(auth)) return auth;
  const { supabase, userId } = auth;
  const { error } = await supabase.from("application_events").insert({
    application_id: id,
    user_id: userId,
    status_from: null,
    status_to: null,
    note,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/bewerbungen/${id}`);
  return { ok: true };
}
