import type { Metadata } from "next";
import { listCvDocuments } from "@/lib/cv-actions";
import { CvBuilder } from "@/components/cv/cv-builder";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.cv") };
}

export default async function LebenslaufPage() {
  const saved = await listCvDocuments();
  return <CvBuilder saved={saved} />;
}
