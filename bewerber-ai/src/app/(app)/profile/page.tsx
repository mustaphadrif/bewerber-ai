import type { Metadata } from "next";
import { getFullProfile } from "@/lib/profile";
import { ProfilePage } from "@/components/profile/profile-page";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfileRoute() {
  const full = await getFullProfile();
  return <ProfilePage full={full} />;
}
