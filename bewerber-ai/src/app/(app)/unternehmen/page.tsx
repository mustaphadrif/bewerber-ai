import type { Metadata } from "next";
import { listCompanies, getIndustries } from "@/lib/companies";
import { CompanyDirectory } from "@/components/companies/company-directory";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.companies") };
}

export default async function UnternehmenPage() {
  const [companies, industries] = await Promise.all([listCompanies(), getIndustries()]);
  return <CompanyDirectory companies={companies} industries={industries} />;
}
