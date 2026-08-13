import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getApplication } from "@/lib/applications";
import { ApplicationDetail } from "@/components/applications/application-detail";

export const metadata: Metadata = { title: "Bewerbungsdetails" };

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { application, events } = await getApplication(id);
  if (!application) notFound();
  return <ApplicationDetail application={application} events={events} />;
}
