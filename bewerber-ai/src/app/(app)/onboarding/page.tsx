import type { Metadata } from "next";
import { getFullProfile } from "@/lib/profile";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata: Metadata = { title: "Onboarding" };

export default async function OnboardingPage() {
  const full = await getFullProfile();
  return <OnboardingWizard initial={full} />;
}
