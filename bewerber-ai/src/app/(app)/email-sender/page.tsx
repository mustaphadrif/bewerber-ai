import type { Metadata } from "next";
import { getEmailSenderState } from "@/lib/email/actions";
import { CampaignDashboard } from "@/components/email-sender/campaign-dashboard";

export const metadata: Metadata = { title: "E-Mail Sender" };

export default async function EmailSenderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const gmail = typeof params.gmail === "string" ? params.gmail : null;
  const state = await getEmailSenderState();
  return <CampaignDashboard initial={state} gmailNotice={gmail} />;
}
