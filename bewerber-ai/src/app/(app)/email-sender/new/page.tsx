import type { Metadata } from "next";
import { getEmailSenderState } from "@/lib/email/actions";
import { CampaignComposer } from "@/components/email-sender/campaign-composer";

export const metadata: Metadata = { title: "Neue E-Mail-Kampagne" };

export default async function EmailSenderNewPage() {
  const state = await getEmailSenderState();
  return <CampaignComposer initialLimit={state.entitlement.limit} />;
}
