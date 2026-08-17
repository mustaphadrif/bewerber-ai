"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useI18n } from "@/lib/i18n/client";
import type { GmailStatus } from "@/lib/email/types";
import { Mail, CheckCircle2 } from "lucide-react";

/**
 * Gmail connection card. Shows a safe unavailable state when credentials are
 * missing, a connect button otherwise, and connection metadata when linked.
 * Tokens never appear here — only the account label and requested scope.
 */
export function GmailConnect({ gmail }: { gmail: GmailStatus }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-4.5 w-4.5 text-primary" />
          {t("emailSender.gmailTitle")}
        </CardTitle>
        <CardDescription>
          {t("emailSender.gmailDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!gmail.available ? (
          <Alert variant="warning">
            {t("emailSender.gmailUnavailableText")}
          </Alert>
        ) : gmail.connected ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <CheckCircle2 className="h-4 w-4 text-success" />
              {t("emailSender.connectedPrefix", { email: gmail.email ?? t("emailSender.defaultGmailAccount") })}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("emailSender.scopeNote", { scope: gmail.scope ?? t("emailSender.defaultScope") })}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              {t("emailSender.connectHint")}
            </p>
            <a href="/api/email-sender/gmail/start">
              <Button size="sm">{t("emailSender.connectButton")}</Button>
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
