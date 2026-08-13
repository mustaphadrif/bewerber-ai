import type { Metadata } from "next";
import { getFullProfile } from "@/lib/profile";
import { listCvDocuments } from "@/lib/cv-actions";
import { CvBuilder } from "@/components/cv/cv-builder";

export const metadata: Metadata = { title: "Lebenslauf" };

export default async function LebenslaufPage() {
  const full = await getFullProfile();
  const saved = await listCvDocuments();
  return <CvBuilder full={full} saved={saved} />;
}
