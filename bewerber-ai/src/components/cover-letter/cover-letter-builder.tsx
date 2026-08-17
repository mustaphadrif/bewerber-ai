"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { profileCompletion } from "@/lib/cv";
import { useI18n } from "@/lib/i18n/client";
import type { FullProfile } from "@/lib/profile";
import {
  generateCoverLetterAction,
  saveCoverLetterManually,
  deleteCoverLetter,
} from "@/lib/cover-letter-actions";
import type { CoverLetter } from "@/lib/db";
import { Sparkles, PenLine, Save, Trash2, KeyRound } from "lucide-react";

const TONES = ["professionell", "motiviert", "formell"] as const;

export function CoverLetterBuilder({ full, letters }: { full: FullProfile; letters: CoverLetter[] }) {
  const router = useRouter();
  const { t, formatDate } = useI18n();
  const [mode, setMode] = useState<"ki" | "manuell">("ki");
  const [form, setForm] = useState({
    companyName: "",
    jobTitle: "",
    recipientName: "",
    tone: "professionell" as (typeof TONES)[number],
    keyPoints: "",
    companyNotes: "",
    jobUrl: "",
  });
  const [manualContent, setManualContent] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credentialNotice, setCredentialNotice] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const completion = profileCompletion(full);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleGenerate() {
    setError(null);
    setNotice(null);
    setCredentialNotice(false);
    startTransition(async () => {
      const res = await generateCoverLetterAction({
        companyName: form.companyName,
        jobTitle: form.jobTitle,
        recipientName: form.recipientName || null,
        tone: form.tone,
        keyPoints: form.keyPoints
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        companyNotes: form.companyNotes || undefined,
        jobUrl: form.jobUrl || null,
      });
      if (!res.ok) {
        setError(res.error);
        if (res.code === "no-credential") setCredentialNotice(true);
        return;
      }
      setResult(res.content ?? null);
      setNotice(t("coverLetter.notices.created"));
      router.refresh();
    });
  }

  function handleManualSave() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await saveCoverLetterManually({
        company_name: form.companyName,
        job_title: form.jobTitle,
        recipient_name: form.recipientName || null,
        content: manualContent,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotice(t("coverLetter.notices.saved"));
      setManualContent("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("coverLetter.title")}</h1>
        <p className="mt-1 text-muted-foreground">
          {t("coverLetter.subtitle")}
        </p>
      </div>

      {error && <Alert variant={credentialNotice ? "warning" : "error"}>{error}</Alert>}
      {credentialNotice && (
        <Alert variant="warning" className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>{t("coverLetter.keyMissing")}</strong> {t("coverLetter.keyMissingText")}
          </span>
        </Alert>
      )}
      {notice && <Alert variant="success">{notice}</Alert>}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardContent className="p-2">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                <button
                  onClick={() => setMode("ki")}
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${mode === "ki" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
                >
                  <Sparkles className="h-4 w-4" /> {t("coverLetter.tabAi")}
                </button>
                <button
                  onClick={() => setMode("manuell")}
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${mode === "manuell" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
                >
                  <PenLine className="h-4 w-4" /> {t("coverLetter.tabManual")}
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("coverLetter.jobInfo")}</CardTitle>
              <CardDescription>{t("coverLetter.jobInfoDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="cl-company">{t("coverLetter.company")}</Label>
                <Input id="cl-company" value={form.companyName} onChange={set("companyName")} placeholder={t("coverLetter.companyPh")} />
              </div>
              <div>
                <Label htmlFor="cl-title">{t("coverLetter.position")}</Label>
                <Input id="cl-title" value={form.jobTitle} onChange={set("jobTitle")} placeholder={t("coverLetter.positionPh")} />
              </div>
              <div>
                <Label htmlFor="cl-recipient">{t("coverLetter.recipient")}</Label>
                <Input id="cl-recipient" value={form.recipientName} onChange={set("recipientName")} placeholder={t("coverLetter.recipientPh")} />
              </div>
              <div>
                <Label htmlFor="cl-url">{t("coverLetter.url")}</Label>
                <Input id="cl-url" type="url" value={form.jobUrl} onChange={set("jobUrl")} placeholder={t("coverLetter.urlPh")} />
              </div>
              {mode === "ki" && (
                <>
                  <div>
                    <Label htmlFor="cl-tone">{t("coverLetter.tone")}</Label>
                    <Select id="cl-tone" value={form.tone} onChange={set("tone")}>
                      {TONES.map((tone) => <option key={tone} value={tone}>{t(`coverLetter.tones.${tone}`)}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="cl-points">{t("coverLetter.keyPoints")}</Label>
                    <Input id="cl-points" value={form.keyPoints} onChange={set("keyPoints")} placeholder={t("coverLetter.keyPointsPh")} />
                  </div>
                  <div>
                    <Label htmlFor="cl-notes">{t("coverLetter.companyNotes")}</Label>
                    <Textarea id="cl-notes" rows={3} value={form.companyNotes} onChange={set("companyNotes")} placeholder={t("coverLetter.companyNotesPh")} />
                  </div>
                  <Button className="w-full" onClick={handleGenerate} loading={pending} disabled={!form.companyName.trim() || !form.jobTitle.trim()}>
                    <Sparkles className="h-4 w-4" /> {t("coverLetter.generate")}
                  </Button>
                </>
              )}
              {mode === "manuell" && (
                <>
                  <div>
                    <Label htmlFor="cl-manual">{t("coverLetter.manualText")}</Label>
                    <Textarea
                      id="cl-manual"
                      rows={12}
                      value={manualContent}
                      onChange={(e) => setManualContent(e.target.value)}
                      placeholder={t("coverLetter.manualPh", {
                        name: [full.profile?.first_name, full.profile?.last_name].filter(Boolean).join(" ") || "",
                      })}
                    />
                  </div>
                  <Button className="w-full" variant="outline" onClick={handleManualSave} loading={pending} disabled={!form.companyName.trim() || !form.jobTitle.trim() || !manualContent.trim()}>
                    <Save className="h-4 w-4" /> {t("coverLetter.manualSave")}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Result */}
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>{t("coverLetter.result")}</CardTitle>
              <CardDescription>
                {result ? t("coverLetter.resultPreview", { company: form.companyName || t("common.unknown") }) : t("coverLetter.resultEmpty")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="whitespace-pre-wrap rounded-lg border border-border bg-white p-6 text-sm leading-relaxed text-slate-800 shadow-inner">
                  {result}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-14 text-center">
                  <PenLine className="h-8 w-8 text-slate-300" />
                  <p className="max-w-sm text-sm text-muted-foreground">
                    {mode === "ki"
                      ? t("coverLetter.emptyAi")
                      : t("coverLetter.emptyManual")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {completion < 60 && (
            <Alert variant="info">
              {t("coverLetter.profileHint", { percent: completion })}{" "}
              <a href="/profile" className="font-medium underline">{t("coverLetter.completeProfile")}</a>.
            </Alert>
          )}

          {letters.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("coverLetter.savedTitle")}</CardTitle>
                <CardDescription>{t("coverLetter.savedCount", { count: letters.length })}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {letters.map((l) => (
                  <div key={l.id} className="rounded-lg border border-border bg-muted/40 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{l.job_title} · {l.company_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.generated_by.startsWith("ki-") || l.generated_by === "ai"
                            ? t("coverLetter.sourceAi")
                            : l.generated_by === "manuell" || l.generated_by === "manual"
                              ? t("coverLetter.sourceManual")
                              : l.generated_by} · {formatDate(l.created_at)}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          startTransition(async () => {
                            const res = await deleteCoverLetter(l.id);
                            if (res.ok) {
                              router.refresh();
                              setNotice(t("coverLetter.notices.deleted"));
                            } else setError(res.error);
                          })
                        }
                        className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        aria-label={t("coverLetter.deleteAria")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <Separator className="my-2" />
                    <p className="line-clamp-3 whitespace-pre-wrap text-xs text-slate-600">{l.content}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
