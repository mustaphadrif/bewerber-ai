import type { Metadata } from "next";
import { getFullProfile } from "@/lib/profile";
import { listCoverLetters } from "@/lib/cover-letter-actions";
import { CoverLetterBuilder } from "@/components/cover-letter/cover-letter-builder";

export const metadata: Metadata = { title: "Anschreiben" };

export default async function AnschreibenPage() {
  const full = await getFullProfile();
  const letters = await listCoverLetters();
  return <CoverLetterBuilder full={full} letters={letters} />;
}
