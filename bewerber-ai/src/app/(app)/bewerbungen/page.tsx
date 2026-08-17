import type { Metadata } from "next";
import { listApplications } from "@/lib/applications";
import { ApplicationsList } from "@/components/applications/applications-list";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.applications") };
}

export default async function BewerbungenPage() {
  const applications = await listApplications();
  return <ApplicationsList initial={applications} />;
}
