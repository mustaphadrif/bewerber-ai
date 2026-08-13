import type { Metadata } from "next";
import { listApplications } from "@/lib/applications";
import { ApplicationsList } from "@/components/applications/applications-list";

export const metadata: Metadata = { title: "Bewerbungen" };

export default async function BewerbungenPage() {
  const applications = await listApplications();
  return <ApplicationsList initial={applications} />;
}
