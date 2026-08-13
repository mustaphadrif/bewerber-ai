import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";

/**
 * Auth-protected route group. Without Supabase env vars there is no session,
 * so users are routed to /login which explains how to enable auth.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <AppShell
      user={{
        email: user.email ?? null,
        fullName:
          ((user.user_metadata?.full_name as string | undefined) ??
            ((user.user_metadata?.name as string | undefined) ?? null)) ?? null,
      }}
    >
      {children}
    </AppShell>
  );
}
