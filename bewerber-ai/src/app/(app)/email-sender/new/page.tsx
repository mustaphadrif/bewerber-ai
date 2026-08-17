import type { Metadata } from "next";
import { getEmailSenderState } from "@/lib/email/actions";
import { CampaignComposer } from "@/components/email-sender/campaign-composer";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.newCampaign") };
}

export default async function EmailSenderNewPage() {
  const state = await getEmailSenderState();
  return <CampaignComposer initialLimit={state.entitlement.limit} />;
}
