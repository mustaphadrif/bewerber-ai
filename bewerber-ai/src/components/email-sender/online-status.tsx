"use client";

import { useOnlineStatus } from "@/lib/email/use-online-status";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/client";
import { Wifi, WifiOff } from "lucide-react";

/**
 * Honest online/offline indicator. Shows the real browser connection state.
 */
export function OnlineStatus() {
  const { t } = useI18n();
  const state = useOnlineStatus();
  const online = state === "online";
  return (
    <Badge variant={online ? "success" : "warning"} className="gap-1.5">
      {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {online ? t("emailSender.online") : t("emailSender.offline")}
    </Badge>
  );
}
