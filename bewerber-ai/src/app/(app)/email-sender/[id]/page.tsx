import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCampaignDetail } from "@/lib/email/actions";
import { CampaignDetail } from "@/components/email-sender/campaign-detail";

export const metadata: Metadata = { title: "Kampagnen-Details" };

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
