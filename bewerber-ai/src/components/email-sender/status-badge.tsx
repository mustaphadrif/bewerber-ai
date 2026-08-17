"use client";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/client";
import type { CampaignStatus, RecipientStatus } from "@/lib/email/types";

const CAMPAIGN_VARIANTS: Record<CampaignStatus, "secondary" | "warning" | "success" | "destructive" | "blue"> = {
  draft: "secondary",
  pending: "blue",
  sending: "blue",
  paused: "warning",
  stopped: "secondary",
  sent: "success",
  failed: "destructive",
};

const RECIPIENT_VARIANTS: Record<RecipientStatus, "secondary" | "warning" | "success" | "destructive"> = {
  pending: "secondary",
  sending: "warning",
  sent: "success",
  failed: "destructive",
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const { t } = useI18n();
  return <Badge variant={CAMPAIGN_VARIANTS[status]}>{t(`emailSender.campaignStatuses.${status}`)}</Badge>;
}

export function RecipientStatusBadge({ status }: { status: RecipientStatus }) {
  const { t } = useI18n();
  return <Badge variant={RECIPIENT_VARIANTS[status]}>{t(`emailSender.recipientStatuses.${status}`)}</Badge>;
}
