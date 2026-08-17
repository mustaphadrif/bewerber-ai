import type { Metadata } from "next";
import { getFullProfile } from "@/lib/profile";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.onboarding") };
}

export default async function OnboardingPage() {
  const full = await getFullProfile();
  return <OnboardingWizard initial={full} />;
}
