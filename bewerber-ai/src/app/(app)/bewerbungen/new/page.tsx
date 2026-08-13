import type { Metadata } from "next";
import { listCompanies } from "@/lib/companies";
import { ApplicationForm } from "@/components/applications/application-form";

export const metadata: Metadata = { title: "Neue Bewerbung" };

export default async function NewApplicationPage() {
  const companies = await listCompanies();
  return <ApplicationForm companies={companies} />;
}
