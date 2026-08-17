"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { CampaignStatusBadge, RecipientStatusBadge } from "@/components/email-sender/status-badge";
import { useI18n } from "@/lib/i18n/client";
import {
  queueStart,
  queuePause,
  queueResume,
  queueStop,
  retryFailed,
  removeFailedRecipient,
  exportFailedCsv,
} from "@/lib/email/actions";
import type { CampaignDetail as CampaignDetailData } from "@/lib/email/types";
import { ArrowLeft, Send, Pause, Play, Square, RefreshCw, Trash2, Download, Clock } from "lucide-react";

interface CampaignDetailProps {
  initial: CampaignDetailData;
  startFailed?: boolean;
}

export function CampaignDetail({ initial, startFailed }: CampaignDetailProps) {
  const router = useRouter();
  const { t, formatDateTime } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { campaign, recipients, events } = initial;
  const m = campaign.metrics;
  const failedRecipients = recipients.filter((r) => r.status === "failed");
  const canEdit = campaign.status === "draft" || campaign.status === "pending";
  const isRunning = campaign.status === "pending" || campaign.status === "sending";

  // While the campaign is queued/running, trigger the server delivery worker
  // periodically and refresh the server-maintained state. Actual sends only
  // ever happen server-side and are gated by Gmail configuration.
  useEffect(() => {
    if (!isRunning) return;
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const kick = async () => {
      try {
        await fetch("/api/email-sender/worker", { method: "POST" });
      } catch {
        // offline — ignore
      }
      if (active) router.refresh();
    };
    void kick();
    timer = setInterval(() => void kick(), 6000);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [isRunning, campaign.id, router]);

  function run(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? t("emailSender.actionFailed"));
      } else if (result.message) {
        setInfo(result.message);
      }
      router.refresh();
    });
  }

  async function handleExport() {
    const csv = await exportFailedCsv(campaign.id);
    if (!csv) return;
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fehlerhafte-emails-${campaign.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/email-sender" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-slate-900">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t("emailSender.back")}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{campaign.title}</h1>
            <p className="mt-1 text-muted-foreground">
              {t("emailSender.subjectLine", { subject: campaign.subject || "–" })} · {t("emailSender.createdOn", { date: formatDateTime(campaign.created_at) })}
            </p>
          </div>
          <CampaignStatusBadge status={campaign.status} />
        </div>
      </div>

      {startFailed && (
        <Alert variant="warning">
          {t("emailSender.startFailed")}
        </Alert>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      {info && <Alert variant="success">{info}</Alert>}

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>{t("emailSender.controls")}</CardTitle>
          <CardDescription>{t("emailSender.controlsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label={t("emailSender.total")} value={m.total} />
            <Metric label={t("emailSender.sent")} value={m.sent} accent="text-emerald-700" />
            <Metric label={t("emailSender.remaining")} value={m.remaining} accent="text-amber-700" />
            <Metric label={t("emailSender.failed")} value={m.failed} accent="text-red-700" />
          </div>
          <Progress value={m.progressPercent} />

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => run(() => queueStart(campaign.id))}
              disabled={pending || m.total === 0 || campaign.status === "sent" || campaign.status === "sending"}
            >
              <Send className="h-4 w-4" /> {t("common.start")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => run(() => queuePause(campaign.id))}
              disabled={pending || (campaign.status !== "pending" && campaign.status !== "sending")}
            >
              <Pause className="h-4 w-4" /> {t("common.pause")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => run(() => queueResume(campaign.id))}
              disabled={pending || campaign.status !== "paused"}
            >
              <Play className="h-4 w-4" /> {t("common.resume")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => run(() => queueStop(campaign.id))}
              disabled={pending || campaign.status === "stopped" || campaign.status === "sent"}
            >
              <Square className="h-4 w-4" /> {t("common.stop")}
            </Button>
          </div>

          {canEdit && (
            <p className="text-xs text-muted-foreground">
              {t("emailSender.editHint")}
            </p>
          )}
          {campaign.status === "pending" && (
            <p className="text-xs text-amber-700">
              {t("emailSender.pendingNote")}
            </p>
          )}
          {campaign.last_error && (
            <p className="text-xs text-red-700">{t("emailSender.lastError", { error: campaign.last_error })}</p>
          )}
        </CardContent>
      </Card>

      {/* Failed recipients */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>{t("emailSender.failedTitle")}</CardTitle>
            <CardDescription>
              {t("emailSender.failedDesc")}
            </CardDescription>
          </div>
          {failedRecipients.length > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => run(() => retryFailed(campaign.id))} disabled={pending}>
                <RefreshCw className="h-3.5 w-3.5" /> {t("emailSender.retryAll")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleExport()} disabled={pending}>
                <Download className="h-3.5 w-3.5" /> {t("emailSender.export")}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {failedRecipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("emailSender.emptyFailedDetail")}</p>
          ) : (
            <div className="divide-y divide-border">
              {failedRecipients.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">{r.email}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.failure_reason ?? t("emailSender.noReason")}
                      {r.rate_limited ? ` · ${t("emailSender.rateLimited")}` : ""}
                    </div>
                  </div>
                  <div className="hidden text-xs text-muted-foreground sm:block">
                    {formatDateTime(r.updated_at)}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => run(() => removeFailedRecipient(campaign.id, r.id))}
                    disabled={pending}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {t("emailSender.remove")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recipients */}
      <Card>
        <CardHeader>
          <CardTitle>{t("emailSender.recipientsTitle", { count: recipients.length })}</CardTitle>
          <CardDescription>
            {t("emailSender.recipientsTableDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("emailSender.emptyRecipients")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-2 py-2 font-medium">{t("emailSender.email")}</th>
                    <th className="px-2 py-2 font-medium">{t("emailSender.company")}</th>
                    <th className="px-2 py-2 font-medium">{t("emailSender.contact")}</th>
                    <th className="px-2 py-2 font-medium">{t("emailSender.status")}</th>
                    <th className="px-2 py-2 font-medium">{t("common.details")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recipients.map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-2 text-slate-900">{r.email}</td>
                      <td className="px-2 py-2 text-muted-foreground">{r.company ?? "–"}</td>
                      <td className="px-2 py-2 text-muted-foreground">{r.contact_name ?? "–"}</td>
                      <td className="px-2 py-2">
                        <RecipientStatusBadge status={r.status} />
                      </td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {r.status === "failed" && r.failure_reason
                          ? r.failure_reason
                          : r.status === "sent"
                            ? r.gmail_message_id
                              ? t("emailSender.messageId", { id: r.gmail_message_id })
                              : formatDateTime(r.sent_at ?? r.updated_at)
                            : r.status === "pending" && r.next_attempt_at
                              ? t("emailSender.retryAt", { date: formatDateTime(r.next_attempt_at) })
                              : formatDateTime(r.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4.5 w-4.5 text-muted-foreground" />
            {t("emailSender.timeline")}
          </CardTitle>
          <CardDescription>{t("emailSender.timelineDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("emailSender.emptyEvents")}</p>
          ) : (
            <ol className="space-y-3">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/50" />
                  <div>
                    <div className="text-sm text-slate-800">{t(`emailSender.events.${e.event_type}`)}</div>
                    {e.message && <div className="text-xs text-muted-foreground">{e.message}</div>}
                    <div className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
      <div className={`text-xl font-semibold ${accent ?? "text-slate-900"}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
