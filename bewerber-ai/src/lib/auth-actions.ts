"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export type AuthActionResult = { ok: true } | { ok: false; error: string };

function noEnv(): AuthActionResult {
  return {
    ok: false,
    error:
      "Supabase ist nicht konfiguriert. Trage NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY in die Umgebung ein, um dich anzumelden.",
  };
}

export async function signInWithPassword(email: string, password: string): Promise<AuthActionResult> {
  const supabase = await createClient();
  if (!supabase) return noEnv();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signUpWithPassword(email: string, password: string, fullName?: string): Promise<AuthActionResult> {
  const supabase = await createClient();
  if (!supabase) return noEnv();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
      data: fullName ? { full_name: fullName } : undefined,
    },
  });
  if (error) return { ok: false, error: error.message };

  // Seed the profile row on signup when the user is created immediately.
  if (data.user) {
    const [first = "", last = ""] = (fullName ?? "").trim().split(/\s+/);
    await supabase.from("profiles").upsert(
      {
        user_id: data.user.id,
        email: data.user.email,
        first_name: first || null,
        last_name: last || null,
        onboarding_step: 1,
        onboarding_completed: false,
      },
      { onConflict: "user_id" }
    );
  }
  return { ok: true };
}

export async function signInWithGoogle(): Promise<AuthActionResult> {
  const supabase = await createClient();
  if (!supabase) return noEnv();
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
