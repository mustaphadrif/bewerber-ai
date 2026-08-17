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
import { useI18n } from "@/lib/i18n/client";
import {
  queuePause,
  queueResume,
  queueStop,
  retryFailed,
  removeFailedRecipient,
} from "@/lib/email/actions";
import type { DashboardState, EmailRecipient } from "@/lib/email/types";
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
  const { t, formatDateTime } = useI18n();
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
      if (!result.ok) setError(result.error ?? t("emailSender.actionFailed"));
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
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("emailSender.title")}</h1>
          <p className="mt-1 text-muted-foreground">
            {t("emailSender.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <OnlineStatus />
          <Link href="/email-sender/new">
            <Button>
              <Plus className="h-4 w-4" /> {t("emailSender.newCampaign")}
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
        <MetricCard label={t("emailSender.total")} value={totals.total} accent="bg-blue-50 text-primary" />
        <MetricCard label={t("emailSender.sent")} value={totals.sent} accent="bg-emerald-50 text-emerald-700" />
        <MetricCard label={t("emailSender.remaining")} value={remaining} accent="bg-amber-50 text-amber-700" />
        <MetricCard label={t("emailSender.failed")} value={totals.failed} accent="bg-red-50 text-red-700" />
      </div>

      {/* Running campaign */}
      <Card className="border-primary/20">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-4.5 w-4.5 text-primary" />
              {t("emailSender.running")}
            </CardTitle>
            <CardDescription>
              {t("emailSender.runningDesc")}
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
                      {t("emailSender.subjectLine", { subject: running.subject || "–" })}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{t("emailSender.sentFailed", { sent: running.metrics.sent, failed: running.metrics.failed })}</div>
                    <div>{t("emailSender.remainingCount", { count: running.metrics.remaining })}</div>
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
                  <Pause className="h-4 w-4" /> {t("common.pause")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => run(() => queueResume(running.id))}
                  disabled={pending || running.status !== "paused"}
                >
                  <Play className="h-4 w-4" /> {t("common.resume")}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => run(() => queueStop(running.id))}
                  disabled={pending}
                >
                  <Square className="h-4 w-4" /> {t("common.stop")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("emailSender.workerNote")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10 text-center">
              <Send className="h-8 w-8 text-slate-300" />
              <div>
                <p className="text-sm font-medium text-slate-700">{t("emailSender.emptyRunning")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("emailSender.emptyRunningText")}
                </p>
              </div>
              <Link href="/email-sender/new">
                <Button size="sm">{t("emailSender.newCampaign")}</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent campaigns */}
      <Card>
        <CardHeader>
          <CardTitle>{t("emailSender.campaigns")}</CardTitle>
          <CardDescription>{t("emailSender.campaignsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Mail className="h-8 w-8 text-slate-300" />
              <div>
                <p className="text-sm font-medium text-slate-700">{t("emailSender.emptyCampaigns")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("emailSender.emptyCampaignsText")}</p>
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
                      {t("emailSender.campaignMetrics", { sent: c.metrics.sent, failed: c.metrics.failed, remaining: c.metrics.remaining })}
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
              {t("emailSender.failedTitle")}
            </CardTitle>
            <CardDescription>
              {t("emailSender.failedDesc")}
            </CardDescription>
          </div>
          {failedRecipients.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => exportFailedCsvClient(failedRecipients)}>
              <Download className="h-4 w-4" /> {t("emailSender.export")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {failedRecipients.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-8 text-center">
              <Inbox className="h-6 w-6 shrink-0 text-slate-300" />
              <p className="text-sm text-muted-foreground">
                {t("emailSender.emptyFailed")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {failedRecipients.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">{r.email}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {campaignTitle.get(r.campaign_id) ?? t("emailSender.unknownCampaign")}
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
                      <RefreshCw className="h-3.5 w-3.5" /> {t("emailSender.retry")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => run(() => removeFailedRecipient(r.campaign_id, r.id))}
                      disabled={pending}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> {t("emailSender.remove")}
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
              {t("emailSender.replies")}
            </CardTitle>
            <CardDescription>
              {t("emailSender.repliesDesc")}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void syncReplies()} loading={syncingReplies}>
            <RefreshCw className="h-4 w-4" /> {t("emailSender.sync")}
          </Button>
        </CardHeader>
        <CardContent>
          {replies.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-8 text-center">
              <MessageSquare className="h-6 w-6 shrink-0 text-slate-300" />
              <p className="text-sm text-muted-foreground">
                {t("emailSender.emptyReplies")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {replies.map((r) => (
                <div key={r.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-medium text-slate-900">
                      {r.from_email ?? t("emailSender.unknownSender")}
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
        {t("emailSender.honestNote")}
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
  const { t } = useI18n();
  const [variant, text] = (() => {
    if (value === "connected") return ["success", t("emailSender.gmailConnected")] as const;
    if (value === "unavailable")
      return ["warning", t("emailSender.gmailUnavailable")] as const;
    return ["error", t("emailSender.gmailFailed", { code: value })] as const;
  })();
  return <Alert variant={variant}>{text}</Alert>;
}
