import type { Metadata } from "next";
import { listCvDocuments } from "@/lib/cv-actions";
import { CvBuilder } from "@/components/cv/cv-builder";

export const metadata: Metadata = { title: "Lebenslauf" };

export default async function LebenslaufPage() {
  const saved = await listCvDocuments();
  return <CvBuilder saved={saved} />;
}
