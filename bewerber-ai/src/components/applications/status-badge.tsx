"use client";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/client";
import type { ApplicationStatus } from "@/lib/db";

const STATUS_VARIANTS: Record<ApplicationStatus, "default" | "secondary" | "outline" | "success" | "warning" | "destructive" | "blue"> = {
  interessiert: "secondary",
  beworben: "blue",
  gesehen: "outline",
  interview: "warning",
  angebot: "success",
  abgelehnt: "destructive",
  archiviert: "secondary",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const { t } = useI18n();
  const variant = STATUS_VARIANTS[status] ?? STATUS_VARIANTS.interessiert;
  return <Badge variant={variant}>{t(`applications.statuses.${status}`)}</Badge>;
}
