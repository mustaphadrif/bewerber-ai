import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.signup") };
}

export default async function SignupPage() {
  const { t } = await getI18n();
  return (
    <AuthShell title={t("auth.signupTitle")} description={t("auth.signupDescription")}>
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
