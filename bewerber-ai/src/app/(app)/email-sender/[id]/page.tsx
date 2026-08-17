import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCampaignDetail } from "@/lib/email/actions";
import { CampaignDetail } from "@/components/email-sender/campaign-detail";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.campaignDetail") };
}

export default async function EmailSenderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const search = await searchParams;
  const detail = await getCampaignDetail(id);
  if (!detail) notFound();

  return <CampaignDetail initial={detail} startFailed={search.start === "failed"} />;
}
