import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Kostenlos registrieren" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Kostenlos starten"
      description="Erstelle dein Konto – in 2 Minuten zum ersten Lebenslauf."
    >
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
