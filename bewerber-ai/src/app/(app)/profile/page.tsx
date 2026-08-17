import type { Metadata } from "next";
import { getFullProfile } from "@/lib/profile";
import { ProfilePage } from "@/components/profile/profile-page";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.profile") };
}

export default async function ProfileRoute() {
  const full = await getFullProfile();
  return <ProfilePage full={full} />;
}
