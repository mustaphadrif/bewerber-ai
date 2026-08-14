"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { GmailStatus } from "@/lib/email/types";
import { Mail, CheckCircle2 } from "lucide-react";

/**
 * Gmail connection card. Shows a safe unavailable state when credentials are
 * missing, a connect button otherwise, and connection metadata when linked.
 * Tokens never appear here — only the account label and requested scope.
 */
export function GmailConnect({ gmail }: { gmail: GmailStatus }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-4.5 w-4.5 text-primary" />
          Gmail-Anbindung
        </CardTitle>
        <CardDescription>
          Getrennt vom App-Login. Verwendet gmail.send (E-Mails senden) und den minimalen
          Lese-Scope gmail.metadata (nur Kopfzeilen/Snippets) — ausschließlich für die
          Antwort-Erkennung auf selbst gesendete Threads. Kein Zugriff auf andere Nachrichten,
          Kontakte oder Anhänge fremder E-Mails.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!gmail.available ? (
          <Alert variant="warning">
            Gmail ist in dieser Umgebung nicht konfiguriert (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET und
            GMAIL_REDIRECT_URI fehlen). Der E-Mail-Versand bleibt daher deaktiviert.
          </Alert>
        ) : gmail.connected ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Verbunden: {gmail.email ?? "Gmail-Konto"}
            </div>
            <p className="text-xs text-muted-foreground">
              Gewährter Scope: {gmail.scope ?? "gmail.send, gmail.metadata"}. Antworten werden vom
              Server-Worker nur für Threads abgerufen, die diese App gesendet hat — keine fremden
              E-Mails werden gelesen.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              Verbinde ein Gmail-Konto, um Kampagnen starten zu können. Es wird gmail.send sowie
              der minimale Lese-Scope gmail.metadata angefragt (für Antwort-Erkennung auf
              app-gesendete Threads).
            </p>
            <a href="/api/email-sender/gmail/start">
              <Button size="sm">Mit Gmail verbinden</Button>
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
