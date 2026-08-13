import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Anmelden" };

export default function LoginPage() {
  return (
    <AuthShell title="Willkommen zurück" description="Melde dich an und fahre mit deinen Bewerbungen fort.">
      <AuthForm mode="login" />
    </AuthShell>
  );
}
