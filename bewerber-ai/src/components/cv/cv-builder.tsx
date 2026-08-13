"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { CvPreview } from "@/components/cv/cv-preview";
import { exportCvPdf } from "@/lib/cv-pdf";
import {
  ACCENT_COLORS,
  CV_TEMPLATES,
  DEFAULT_CV_OPTIONS,
  buildCvData,
  type CvOptions,
} from "@/lib/cv";
import type { FullProfile } from "@/lib/profile";
import { saveCvDocument, deleteCvDocument } from "@/lib/cv-actions";
import type { CvDocument } from "@/lib/db";
import { Download, Save, Trash2, FileText } from "lucide-react";

export function CvBuilder({
  full,
  saved,
}: {
  full: FullProfile;
  saved: CvDocument[];
}) {
  const router = useRouter();
  const [options, setOptions] = useState<CvOptions>({ ...DEFAULT_CV_OPTIONS });
  const [title, setTitle] = useState("Lebenslauf");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const data = buildCvData(full);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, successMsg: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Unbekannter Fehler");
        return;
      }
      setNotice(successMsg);
      router.refresh();
    });
  }

  function handleDownload() {
    exportCvPdf(data, options);
    setNotice("PDF heruntergeladen – erstellt aus deinen verifizierten Profildaten.");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Lebenslauf</h1>
        <p className="mt-1 text-muted-foreground">
          Wähle eine Vorlage – dein Lebenslauf wird live aus deinen Profildaten erstellt. Es werden ausschließlich verifizierte Angaben übernommen.
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Controls */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Vorlage</CardTitle>
              <CardDescription>3 Layouts zur Auswahl</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {CV_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setOptions((o) => ({ ...o, template: t.id }))}
                  className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                    options.template === t.id
                      ? "border-primary bg-blue-50/60 ring-1 ring-primary/30"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="text-sm font-medium text-slate-900">{t.label}</div>
                  <div className="text-xs text-muted-foreground">{t.description}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gestaltung</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="cv-font">Schriftgröße</Label>
                <Select
                  id="cv-font"
                  value={options.fontSize}
                  onChange={(e) => setOptions((o) => ({ ...o, fontSize: Number(e.target.value) }))}
                >
                  {[10, 11, 12, 13, 14].map((n) => (
                    <option key={n} value={n}>{n} pt</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Akzentfarbe</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {ACCENT_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setOptions((o) => ({ ...o, accentColor: c }))}
                      aria-label={`Farbe ${c}`}
                      className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                        options.accentColor === c ? "border-slate-900" : "border-transparent"
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={options.includePhoto}
                  onChange={(e) => setOptions((o) => ({ ...o, includePhoto: e.target.checked }))}
                  className="h-4 w-4 rounded accent-blue-600"
                />
                Foto einfügen
              </label>
              <p className="text-xs text-muted-foreground">
                {options.includePhoto
                  ? full.profile?.photo_url
                    ? "Foto wird beim Download eingebettet."
                    : "Kein Foto im Profil hinterlegt – lade eines im Profil hoch."
                  : "Ohne Foto wirkt der Lebenslauf neutraler."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Speichern & Export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="cv-title">Titel</Label>
                <Input id="cv-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() =>
                    run(
                      () =>
                        saveCvDocument({
                          title: title.trim() || "Lebenslauf",
                          template: options.template,
                          font_size: options.fontSize,
                          accent_color: options.accentColor,
                          include_photo: options.includePhoto,
                          content: JSON.parse(JSON.stringify(data)),
                        }),
                      "Version gespeichert."
                    )
                  }
                  loading={pending}
                >
                  <Save className="h-4 w-4" /> Speichern
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleDownload} loading={pending}>
                  <Download className="h-4 w-4" /> PDF laden
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                PDF wird direkt im Browser erzeugt (jsPDF) – keine Daten verlassen dein Gerät.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Vorschau</CardTitle>
                <CardDescription>Vorlage „{CV_TEMPLATES.find((t) => t.id === options.template)?.label}“</CardDescription>
              </div>
              <span className="text-xs text-muted-foreground">A4</span>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border bg-slate-200/60 p-3 sm:p-6">
                <CvPreview data={data} options={options} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Saved versions */}
      {saved.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Gespeicherte Versionen</CardTitle>
            <CardDescription>{saved.length} gespeichert</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {saved.map((cv) => (
              <div key={cv.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-medium text-slate-900">{cv.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {cv.template} · {new Date(cv.updated_at).toLocaleDateString("de-DE")}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() =>
                    run(() => deleteCvDocument(cv.id), "Version gelöscht.")
                  }
                  className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                  aria-label="Löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
