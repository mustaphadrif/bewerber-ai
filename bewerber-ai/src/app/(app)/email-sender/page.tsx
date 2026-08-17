import type { Metadata } from "next";
import { getEmailSenderState } from "@/lib/email/actions";
import { CampaignDashboard } from "@/components/email-sender/campaign-dashboard";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.emailSender") };
}

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
