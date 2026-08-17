import type { Metadata } from "next";
import { listCompanies } from "@/lib/companies";
import { ApplicationForm } from "@/components/applications/application-form";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.newApplication") };
}

export default async function NewApplicationPage() {
  const companies = await listCompanies();
  return <ApplicationForm companies={companies} />;
}
