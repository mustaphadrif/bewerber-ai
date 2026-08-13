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
      setNotice("Anschreiben erstellt und gespeichert. Nur verifizierte Profildaten wurden verwendet.");
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
      setNotice("Anschreiben gespeichert.");
      setManualContent("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Anschreiben</h1>
        <p className="mt-1 text-muted-foreground">
          Ehrlich und individuell: Der KI-Assistent arbeitet ausschließlich mit deinen verifizierten Profildaten und erfindet keine Qualifikationen.
        </p>
      </div>

      {error && <Alert variant={credentialNotice ? "warning" : "error"}>{error}</Alert>}
      {credentialNotice && (
        <Alert variant="warning" className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Anbieter-Schlüssel fehlt.</strong> Für die KI-Generierung wird{" "}
            <code className="rounded bg-white/60 px-1">COVER_LETTER_API_KEY</code> in der Umgebung benötigt. Alternativ kannst du im Tab „Manuell verfassen“ dein Anschreiben selbst schreiben und speichern.
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
                  <Sparkles className="h-4 w-4" /> KI-Assistent
                </button>
                <button
                  onClick={() => setMode("manuell")}
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${mode === "manuell" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
                >
                  <PenLine className="h-4 w-4" /> Manuell verfassen
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stelleninformationen</CardTitle>
              <CardDescription>Für beide Modi erforderlich</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="cl-company">Unternehmen *</Label>
                <Input id="cl-company" value={form.companyName} onChange={set("companyName")} placeholder="z. B. SAP SE" />
              </div>
              <div>
                <Label htmlFor="cl-title">Position *</Label>
                <Input id="cl-title" value={form.jobTitle} onChange={set("jobTitle")} placeholder="z. B. Senior Product Manager" />
              </div>
              <div>
                <Label htmlFor="cl-recipient">Ansprechpartner (optional)</Label>
                <Input id="cl-recipient" value={form.recipientName} onChange={set("recipientName")} placeholder="z. B. Frau Dr. Schmidt" />
              </div>
              <div>
                <Label htmlFor="cl-url">Stellenanzeige (URL, optional)</Label>
                <Input id="cl-url" type="url" value={form.jobUrl} onChange={set("jobUrl")} placeholder="https://…" />
              </div>
              {mode === "ki" && (
                <>
                  <div>
                    <Label htmlFor="cl-tone">Tonfall</Label>
                    <Select id="cl-tone" value={form.tone} onChange={set("tone")}>
                      {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="cl-points">Schwerpunkte (kommagetrennt)</Label>
                    <Input id="cl-points" value={form.keyPoints} onChange={set("keyPoints")} placeholder="z. B. E-Commerce, agile Teams" />
                  </div>
                  <div>
                    <Label htmlFor="cl-notes">Notizen zum Unternehmen</Label>
                    <Textarea id="cl-notes" rows={3} value={form.companyNotes} onChange={set("companyNotes")} placeholder="Fakten, die du erwähnen möchtest (z. B. aus der Stellenanzeige)" />
                  </div>
                  <Button className="w-full" onClick={handleGenerate} loading={pending} disabled={!form.companyName.trim() || !form.jobTitle.trim()}>
                    <Sparkles className="h-4 w-4" /> Anschreiben generieren
                  </Button>
                </>
              )}
              {mode === "manuell" && (
                <>
                  <div>
                    <Label htmlFor="cl-manual">Dein Text</Label>
                    <Textarea
                      id="cl-manual"
                      rows={12}
                      value={manualContent}
                      onChange={(e) => setManualContent(e.target.value)}
                      placeholder={"Sehr geehrte Damen und Herren,\n\n…\n\nMit freundlichen Grüßen\n" + ([full.profile?.first_name, full.profile?.last_name].filter(Boolean).join(" ") || "")}
                    />
                  </div>
                  <Button className="w-full" variant="outline" onClick={handleManualSave} loading={pending} disabled={!form.companyName.trim() || !form.jobTitle.trim() || !manualContent.trim()}>
                    <Save className="h-4 w-4" /> Manuell speichern
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
              <CardTitle>Ergebnis</CardTitle>
              <CardDescription>
                {result ? `Vorschau für ${form.companyName || "Unternehmen"}` : "Hier erscheint dein Anschreiben."}
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
                      ? "Fülle die Stelleninformationen aus und generiere dein Anschreiben. Es basiert ausschließlich auf deinem verifizierten Profil."
                      : "Schreibe dein Anschreiben selbst und speichere es – ganz ohne KI."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {completion < 60 && (
            <Alert variant="info">
              Dein Profil ist erst zu {completion}% gefüllt. Ein vollständigeres Profil führt zu besseren Anschreiben –{" "}
              <a href="/profile" className="font-medium underline">Profil vervollständigen</a>.
            </Alert>
          )}

          {letters.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Gespeicherte Anschreiben</CardTitle>
                <CardDescription>{letters.length} gespeichert</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {letters.map((l) => (
                  <div key={l.id} className="rounded-lg border border-border bg-muted/40 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{l.job_title} · {l.company_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.generated_by} · {new Date(l.created_at).toLocaleDateString("de-DE")}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          startTransition(async () => {
                            const res = await deleteCoverLetter(l.id);
                            if (res.ok) {
                              router.refresh();
                              setNotice("Anschreiben gelöscht.");
                            } else setError(res.error);
                          })
                        }
                        className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        aria-label="Löschen"
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
