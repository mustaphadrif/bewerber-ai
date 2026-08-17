import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getApplication } from "@/lib/applications";
import { ApplicationDetail } from "@/components/applications/application-detail";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.applicationDetail") };
}

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { application, events } = await getApplication(id);
  if (!application) notFound();
  return <ApplicationDetail application={application} events={events} />;
}
