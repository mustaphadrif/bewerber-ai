"use client";

import { Badge } from "@/components/ui/badge";
import type { CampaignStatus, RecipientStatus } from "@/lib/email/types";

const CAMPAIGN_LABELS: Record<CampaignStatus, string> = {
  draft: "Entwurf",
  pending: "In Warteschlange",
  sending: "Läuft",
  paused: "Pausiert",
  stopped: "Gestoppt",
  sent: "Gesendet",
  failed: "Fehlgeschlagen",
};

const CAMPAIGN_VARIANTS: Record<CampaignStatus, "secondary" | "warning" | "success" | "destructive" | "blue"> = {
  draft: "secondary",
  pending: "blue",
  sending: "blue",
  paused: "warning",
  stopped: "secondary",
  sent: "success",
  failed: "destructive",
};

const RECIPIENT_LABELS: Record<RecipientStatus, string> = {
  pending: "Bereit",
  sending: "Wird gesendet",
  sent: "Gesendet",
  failed: "Fehlgeschlagen",
};

const RECIPIENT_VARIANTS: Record<RecipientStatus, "secondary" | "warning" | "success" | "destructive"> = {
  pending: "secondary",
  sending: "warning",
  sent: "success",
  failed: "destructive",
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <Badge variant={CAMPAIGN_VARIANTS[status]}>{CAMPAIGN_LABELS[status]}</Badge>;
}

export function RecipientStatusBadge({ status }: { status: RecipientStatus }) {
  return <Badge variant={RECIPIENT_VARIANTS[status]}>{RECIPIENT_LABELS[status]}</Badge>;
}

export { CAMPAIGN_LABELS, RECIPIENT_LABELS };
