import type { Metadata } from "next";
import { getFullProfile } from "@/lib/profile";
import { listCoverLetters } from "@/lib/cover-letter-actions";
import { CoverLetterBuilder } from "@/components/cover-letter/cover-letter-builder";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.coverLetter") };
}

export default async function AnschreibenPage() {
  const full = await getFullProfile();
  const letters = await listCoverLetters();
  return <CoverLetterBuilder full={full} letters={letters} />;
}
