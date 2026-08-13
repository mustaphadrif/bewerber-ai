import type { Metadata } from "next";
import { listCompanies, getIndustries } from "@/lib/companies";
import { CompanyDirectory } from "@/components/companies/company-directory";

export const metadata: Metadata = { title: "Unternehmen" };

export default async function UnternehmenPage() {
  const [companies, industries] = await Promise.all([listCompanies(), getIndustries()]);
  return <CompanyDirectory companies={companies} industries={industries} />;
}
