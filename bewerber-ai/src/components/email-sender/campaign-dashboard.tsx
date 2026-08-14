"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { OnlineStatus } from "@/components/email-sender/online-status";
import { GmailConnect } from "@/components/email-sender/gmail-connect";
import { EntitlementPanel } from "@/components/email-sender/entitlement-panel";
import { CampaignStatusBadge, RecipientStatusBadge } from "@/components/email-sender/status-badge";
import {
  queuePause,
  queueResume,
  queueStop,
  retryFailed,
  removeFailedRecipient,
} from "@/lib/email/actions";
import type { DashboardState, EmailRecipient } from "@/lib/email/types";
import { formatDateTime } from "@/lib/utils";
import {
  Plus,
  Send,
  Pause,
  Play,
  Square,
  RefreshCw,
  Trash2,
  Download,
  Inbox,
  MessageSquare,
  Mail,
  AlertTriangle,
} from "lucide-react";

interface CampaignDashboardProps {
  initial: DashboardState;
  gmailNotice?: string | null;
}

export function CampaignDashboard({ initial, gmailNotice }: CampaignDashboardProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [syncingReplies, setSyncingReplies] = useState(false);

  const { campaigns, running, failedRecipients, replies, entitlement, dailySent, gmail } = initial;

  // While a campaign is queued/running, trigger the server delivery worker
  // periodically and refresh the truthfully server-maintained state. The
  // worker route is the only place where actual sends are attempted — and it
  // is gated by Gmail configuration/connection.
  const runningId = running?.id ?? null;
  useEffect(() => {
    if (!runningId) return;
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const kick = async () => {
      try {
        await fetch("/api/email-sender/worker", { method: "POST" });
      } catch {
        // offline — ignore; state updates on the next successful pass
      }
      if (active) router.refresh();
    };

    void kick();
    timer = setInterval(() => void kick(), 6000);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [runningId, router]);

  async function syncReplies() {
    setSyncingReplies(true);
    try {
      await fetch("/api/email-sender/replies", { method: "POST" });
      router.refresh();
    } catch {
      // offline — ignore
    } finally {
      setSyncingReplies(false);
    }
  }

  const totals = campaigns.reduce(
    (acc, c) => ({
      total: acc.total + c.metrics.total,
      sent: acc.sent + c.metrics.sent,
      failed: acc.failed + c.metrics.failed,
    }),
    { total: 0, sent: 0, failed: 0 }
  );
  const remaining = Math.max(0, totals.total - totals.sent - totals.failed);

  const campaignTitle = new Map(campaigns.map((c) => [c.id, c.title]));

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Aktion fehlgeschlagen.");
      router.refresh();
    });
  }

  function exportFailedCsvClient(rows: EmailRecipient[]) {
    const escape = (value: string | null): string => {
      const s = value ?? "";
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      "Email;Kampagne;Fehlergrund;Zeitpunkt",
      ...rows.map((r) =>
        [escape(r.email), escape(campaignTitle.get(r.campaign_id) ?? ""), escape(r.failure_reason), escape(r.updated_at)].join(";")
      ),
    ];
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fehlerhafte-emails.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">E-Mail Sender</h1>
          <p className="mt-1 text-muted-foreground">
            Kampagnen erstellen, Empfänger verwalten und Versand kontrollieren.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <OnlineStatus />
          <Link href="/email-sender/new">
            <Button>
              <Plus className="h-4 w-4" /> Neue Kampagne
            </Button>
          </Link>
        </div>
      </div>

      {gmailNotice && <GmailNotice value={gmailNotice} />}
      {error && <Alert variant="error">{error}</Alert>}

      {/* Connection + entitlement */}
      <div className="grid gap-6 lg:grid-cols-2">
        <GmailConnect gmail={gmail} />
        <EntitlementPanel
          limit={entitlement.limit}
          status={entitlement.status}
          activatedAt={entitlement.activatedAt}
          dailySent={dailySent}
        />
      </div>

      {/* Aggregate metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Gesamt" value={totals.total} accent="bg-blue-50 text-primary" />
        <MetricCard label="Gesendet" value={totals.sent} accent="bg-emerald-50 text-emerald-700" />
        <MetricCard label="Verbleibend" value={remaining} accent="bg-amber-50 text-amber-700" />
        <MetricCard label="Fehlgeschlagen" value={totals.failed} accent="bg-red-50 text-red-700" />
      </div>

      {/* Running campaign */}
      <Card className="border-primary/20">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-4.5 w-4.5 text-primary" />
              Kampagne läuft
            </CardTitle>
            <CardDescription>
              Aktuell aktive Kampagne (In Warteschlange oder im Versand).
            </CardDescription>
          </div>
          {running && <CampaignStatusBadge status={running.status} />}
        </CardHeader>
        <CardContent>
          {running ? (
            <div className="space-y-4">
              <Link
                href={`/email-sender/${running.id}`}
                className="block rounded-lg bg-muted/40 p-4 transition-colors hover:bg-muted"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-slate-900">{running.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Betreff: {running.subject || "–"}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{running.metrics.sent} gesendet · {running.metrics.failed} fehlgeschlagen</div>
                    <div>{running.metrics.remaining} verbleibend</div>
                  </div>
                </div>
                <Progress value={running.metrics.progressPercent} className="mt-3" />
              </Link>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => run(() => queuePause(running.id))}
                  disabled={pending || running.status !== "pending"}
                >
                  <Pause className="h-4 w-4" /> Pause
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => run(() => queueResume(running.id))}
                  disabled={pending || running.status !== "paused"}
                >
                  <Play className="h-4 w-4" /> Resume
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => run(() => queueStop(running.id))}
                  disabled={pending}
                >
                  <Square className="h-4 w-4" /> Stop
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Der Versand wird vom Server-Worker ausgeführt (ein Empfänger nach dem anderen, mit
                Tageslimit). Es werden keine gesendeten E-Mails behauptet, bevor Gmail sie bestätigt
                hat. Nach einer Verbindungsunterbrechung wird der Status bei der nächsten
                Worker-Ausführung aktualisiert.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10 text-center">
              <Send className="h-8 w-8 text-slate-300" />
              <div>
                <p className="text-sm font-medium text-slate-700">Keine laufende Kampagne</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Lege eine neue Kampagne an und stelle sie in die Warteschlange.
                </p>
              </div>
              <Link href="/email-sender/new">
                <Button size="sm">Neue Kampagne</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent campaigns */}
      <Card>
        <CardHeader>
          <CardTitle>Kampagnen</CardTitle>
          <CardDescription>Deine letzten Kampagnen</CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Mail className="h-8 w-8 text-slate-300" />
              <div>
                <p className="text-sm font-medium text-slate-700">Noch keine Kampagnen</p>
                <p className="mt-1 text-sm text-muted-foreground">Erstelle deine erste E-Mail-Kampagne.</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {campaigns.map((c) => (
                <Link
                  key={c.id}
                  href={`/email-sender/${c.id}`}
                  className="flex flex-wrap items-center gap-3 px-1 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">{c.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.metrics.sent} gesendet · {c.metrics.failed} fehlgeschlagen · {c.metrics.remaining} verbleibend
                    </div>
                  </div>
                  <div className="hidden text-xs text-muted-foreground sm:block">
                    {formatDateTime(c.created_at)}
                  </div>
                  <CampaignStatusBadge status={c.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Failed emails */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4.5 w-4.5 text-destructive" />
              Fehlerhafte E-Mails
            </CardTitle>
            <CardDescription>
              Zuletzt fehlgeschlagene Zustellungen mit Grund — Wiederholen, Entfernen oder Export.
            </CardDescription>
          </div>
          {failedRecipients.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => exportFailedCsvClient(failedRecipients)}>
              <Download className="h-4 w-4" /> Export
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {failedRecipients.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-8 text-center">
              <Inbox className="h-6 w-6 shrink-0 text-slate-300" />
              <p className="text-sm text-muted-foreground">
                Keine fehlgeschlagenen E-Mails vorhanden.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {failedRecipients.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">{r.email}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {campaignTitle.get(r.campaign_id) ?? "Unbekannte Kampagne"}
                      {r.failure_reason ? ` · ${r.failure_reason}` : ""}
                    </div>
                  </div>
                  <div className="hidden text-xs text-muted-foreground sm:block">
                    {formatDateTime(r.updated_at)}
                  </div>
                  <RecipientStatusBadge status={r.status} />
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => run(() => retryFailed(r.campaign_id))}
                      disabled={pending}
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Wiederholen
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => run(() => removeFailedRecipient(r.campaign_id, r.id))}
                      disabled={pending}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Entfernen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Replies */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4.5 w-4.5 text-primary" />
              Antworten
            </CardTitle>
            <CardDescription>
              Serverseitig aus Gmail synchronisiert — nur für Threads, die diese App gesendet hat
              (minimaler Lese-Scope gmail.metadata). Keine fremden E-Mails werden gelesen.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void syncReplies()} loading={syncingReplies}>
            <RefreshCw className="h-4 w-4" /> Synchronisieren
          </Button>
        </CardHeader>
        <CardContent>
          {replies.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-8 text-center">
              <MessageSquare className="h-6 w-6 shrink-0 text-slate-300" />
              <p className="text-sm text-muted-foreground">
                Noch keine Antworten auf gesendete E-Mails erfasst. Nutze „Synchronisieren“, um
                Antworten aus Gmail für deine gesendeten Threads abzurufen.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {replies.map((r) => (
                <div key={r.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-medium text-slate-900">
                      {r.from_email ?? "Unbekannter Absender"}
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">
                      {r.received_at ? formatDateTime(r.received_at) : formatDateTime(r.created_at)}
                    </div>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{r.subject ?? "–"}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Ehrlicher Hinweis: Der Versand erfolgt serverseitig durch den Worker, solange die
        Gmail-Anbindung konfiguriert und verbunden ist. Beim Schließen des Browsers wird keine
        Fortsetzung behauptet — ohne erneute Ausführung des Workers (z. B. erneutes Öffnen der
        Seite oder ein geplanter Cron-Aufruf) wird nicht weiter gesendet.
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
          <Mail className="h-4.5 w-4.5" />
        </div>
        <div className="text-2xl font-semibold text-slate-900">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function GmailNotice({ value }: { value: string }) {
  const [variant, text] = (() => {
    if (value === "connected") return ["success", "Gmail-Konto erfolgreich verbunden."] as const;
    if (value === "unavailable")
      return ["warning", "Gmail-Anbindung ist in dieser Umgebung nicht konfiguriert."] as const;
    return ["error", `Gmail-Verbindung fehlgeschlagen (${value}).`] as const;
  })();
  return <Alert variant={variant}>{text}</Alert>;
}
