"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { CvPreview } from "@/components/cv/cv-preview";
import { exportCvPdf } from "@/lib/cv-pdf";
import {
  ACCENT_COLORS,
  CV_TEMPLATES,
  DEFAULT_CV_OPTIONS,
  buildCvData,
  cvDataFromSaved,
  fullNameOf,
  isCvTemplateId,
  newId,
  type CvData,
  type CvEntry,
  type CvOptions,
} from "@/lib/cv";
import type { FullProfile } from "@/lib/profile";
import { saveCvDocument, deleteCvDocument } from "@/lib/cv-actions";
import type { CvDocument, Json } from "@/lib/db";
import { createClient } from "@/lib/supabase/client";
import { Download, Loader2, Plus, Save, Trash2, FileText, FolderOpen, Upload } from "lucide-react";

const INLINE_PHOTO_LIMIT = 350_000; // chars of a data URL that is safe to persist in cv_documents JSON
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

type EntrySectionKey = "experience" | "internships" | "education";

const ENTRY_SECTION_LABELS: Record<EntrySectionKey, string> = {
  experience: "Berufserfahrung",
  internships: "Praktikum",
  education: "Schulbildung",
};

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = /^data:([^;]+);/.exec(meta)?.[1] ?? "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Upload a photo to Supabase Storage under the owner's path. Returns public URL or null. */
async function uploadPhotoToStorage(dataUrl: string): Promise<string | null> {
  const supabase = createClient();
  if (!supabase) return null;
  try {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return null;
    const blob = dataUrlToBlob(dataUrl);
    const ext = blob.type === "image/png" ? "png" : "jpg";
    const path = `${uid}/cv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("cv-photos").upload(path, blob, {
      contentType: blob.type,
      upsert: false,
    });
    if (error) return null;
    const { data } = supabase.storage.from("cv-photos").getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

export function CvBuilder({ full, saved }: { full: FullProfile; saved: CvDocument[] }) {
  const router = useRouter();
  const [options, setOptions] = useState<CvOptions>({ ...DEFAULT_CV_OPTIONS });
  const [title, setTitle] = useState("Lebenslauf");
  const [draft, setDraft] = useState<CvData>(() => buildCvData(full));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setField = <K extends keyof CvData>(key: K, value: CvData[K]) => {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      if (key === "firstName" || key === "lastName") next.fullName = fullNameOf(next);
      return next;
    });
  };

  const setContact = (key: keyof CvData["contact"], value: string) => {
    setDraft((d) => ({ ...d, contact: { ...d.contact, [key]: value.trim() || null } }));
  };

  const setEntry = (sk: EntrySectionKey, id: string, patch: Partial<CvEntry>) => {
    setDraft((d) => ({
      ...d,
      [sk]: { ...d[sk], items: d[sk].items.map((it) => (it.id === id ? { ...it, ...patch } : it)) },
    }));
  };

  const addEntry = (sk: EntrySectionKey) => {
    setDraft((d) => ({
      ...d,
      [sk]: {
        ...d[sk],
        items: [
          ...d[sk].items,
          { id: newId("cv"), role: "", company: "", location: "", startDate: "", endDate: "", current: false, description: "" },
        ],
      },
    }));
  };

  const removeEntry = (sk: EntrySectionKey, id: string) => {
    setDraft((d) => ({ ...d, [sk]: { ...d[sk], items: d[sk].items.filter((it) => it.id !== id) } }));
  };

  const setSkill = (index: number, name: string) => {
    setDraft((d) => ({ ...d, skills: d.skills.map((s, i) => (i === index ? { ...s, name } : s)) }));
  };
  const addSkill = () => {
    setDraft((d) => ({ ...d, skills: [...d.skills, { name: "", level: 3 }] }));
  };
  const removeSkill = (index: number) => {
    setDraft((d) => ({ ...d, skills: d.skills.filter((_, i) => i !== index) }));
  };

  const setLanguage = (index: number, patch: Partial<CvData["languages"][number]>) => {
    setDraft((d) => ({
      ...d,
      languages: d.languages.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));
  };
  const addLanguage = () => {
    setDraft((d) => ({ ...d, languages: [...d.languages, { name: "", level: "", description: "" }] }));
  };
  const removeLanguage = (index: number) => {
    setDraft((d) => ({ ...d, languages: d.languages.filter((_, i) => i !== index) }));
  };

  function handlePhotoFile(file: File | null) {
    if (!file) return;
    if (!/^image\/(jpeg|png)$/.test(file.type)) {
      setError("Nur JPG/JPEG/PNG-Dateien sind erlaubt.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Das Foto darf maximal 5 MB groß sein.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((d) => ({ ...d, photoDataUrl: String(reader.result), photoName: file.name }));
      setError(null);
    };
    reader.onerror = () => setError("Das Foto konnte nicht gelesen werden.");
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setDraft((d) => ({ ...d, photoDataUrl: null, photoName: "" }));
  }

  async function handleSave() {
    setError(null);
    setNotice(null);
    let resolvedPhoto = draft.photoDataUrl;
    let photoNote: string | null = null;

    if (draft.photoDataUrl && draft.photoDataUrl.startsWith("data:")) {
      const stored = await uploadPhotoToStorage(draft.photoDataUrl);
      if (stored) {
        resolvedPhoto = stored;
      } else if (draft.photoDataUrl.length > INLINE_PHOTO_LIMIT) {
        resolvedPhoto = null;
        photoNote =
          "Foto ist zu groß, um ohne Storage eingebettet zu werden – es wird nur in dieser Vorschau angezeigt und nicht gespeichert.";
      }
    }

    const finalDraft: CvData = { ...draft, photoDataUrl: resolvedPhoto };
    if (resolvedPhoto !== draft.photoDataUrl) setDraft(finalDraft);

    const content: Json = JSON.parse(JSON.stringify(finalDraft));
    startTransition(async () => {
      const result = await saveCvDocument({
        title: title.trim() || "Lebenslauf",
        template: options.template,
        font_size: options.fontSize,
        accent_color: options.accentColor,
        include_photo: options.includePhoto && Boolean(finalDraft.photoDataUrl),
        content,
      });
      if (!result.ok) {
        setError(result.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      setNotice(photoNote ?? "Version gespeichert.");
      router.refresh();
    });
  }

  function handleLoad(cv: CvDocument) {
    setDraft(cvDataFromSaved(cv.content));
    setOptions((o) => ({
      ...o,
      template: isCvTemplateId(cv.template) ? cv.template : o.template,
      fontSize: typeof cv.font_size === "number" ? Math.min(14, Math.max(10, cv.font_size)) : o.fontSize,
      accentColor: typeof cv.accent_color === "string" ? cv.accent_color : o.accentColor,
      includePhoto: typeof cv.include_photo === "boolean" ? cv.include_photo : o.includePhoto,
    }));
    setTitle(cv.title);
    setError(null);
    setNotice(`Version „${cv.title}“ geladen.`);
  }

  async function handleDownload() {
    setError(null);
    setNotice(null);
    try {
      await exportCvPdf(draft, options);
      setNotice("PDF heruntergeladen – erstellt aus deinen aktuellen CV-Daten.");
    } catch {
      setError("PDF konnte nicht erstellt werden.");
    }
  }

  const photoPreview = draft.photoDataUrl;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Lebenslauf</h1>
        <p className="mt-1 text-muted-foreground">
          Bearbeite deine Daten direkt – die Vorschau aktualisiert sich live. Als Startwerte werden deine verifizierten
          Profildaten übernommen.
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ── Form ── */}
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Persönliche Daten</CardTitle>
              <CardDescription>Name, Titel, Kontakt, Geburtsdatum und Foto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Vorname">
                  <Input value={draft.firstName} onChange={(e) => setField("firstName", e.target.value)} placeholder="Mustapha" />
                </Field>
                <Field label="Nachname">
                  <Input value={draft.lastName} onChange={(e) => setField("lastName", e.target.value)} placeholder="Drif" />
                </Field>
              </div>
              <Field label="Titel / Berufsbezeichnung">
                <Input value={draft.headline} onChange={(e) => setField("headline", e.target.value)} placeholder="Kaufmann im E-Commerce" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="E-Mail">
                  <Input type="email" value={draft.contact.email ?? ""} onChange={(e) => setContact("email", e.target.value)} placeholder="name@example.com" />
                </Field>
                <Field label="Telefon">
                  <Input value={draft.contact.phone ?? ""} onChange={(e) => setContact("phone", e.target.value)} placeholder="+212 777 258 019" />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ort">
                  <Input value={draft.location} onChange={(e) => setField("location", e.target.value)} placeholder="Casablanca, Marokko" />
                </Field>
                <Field label="Geburtsdatum">
                  <Input value={draft.birthDate} onChange={(e) => setField("birthDate", e.target.value)} placeholder="13.07.2003" />
                </Field>
              </div>
              <Field label="Foto (JPG/PNG)">
                <div className="flex items-center gap-4">
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Foto-Vorschau"
                      className="h-20 w-20 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-border bg-muted/50 text-xs text-muted-foreground">
                      kein Foto
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <label
                        htmlFor="cv-photo-input"
                        className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-muted"
                      >
                        <Upload className="h-4 w-4" />
                        {draft.photoDataUrl ? "Ersetzen" : "Foto wählen"}
                      </label>
                      {draft.photoDataUrl && (
                        <Button type="button" variant="outline" size="icon" onClick={removePhoto} aria-label="Foto entfernen">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <input
                      id="cv-photo-input"
                      type="file"
                      accept="image/jpeg,image/png"
                      className="hidden"
                      onChange={(e) => handlePhotoFile(e.target.files?.[0] ?? null)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Erscheint rund oben rechts. Wird beim Speichern mitgespeichert (Supabase Storage oder eingebettet,
                      sofern größenmäßig sinnvoll).
                    </p>
                  </div>
                </div>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profil</CardTitle>
              <CardDescription>Zusammenfassung unter „Profil“</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={draft.about}
                onChange={(e) => setField("about", e.target.value)}
                rows={6}
                placeholder="Motivierter Bewerber für die Ausbildung zum Kaufmann im E-Commerce …"
              />
            </CardContent>
          </Card>

          <EntrySectionCard
            title={ENTRY_SECTION_LABELS.experience}
            hint="Position, Firma, Zeitraum, Ort und Stichpunkte (eine pro Zeile)"
            entries={draft.experience.items}
            onChange={(id, patch) => setEntry("experience", id, patch)}
            onAdd={() => addEntry("experience")}
            onRemove={(id) => removeEntry("experience", id)}
          />
          <EntrySectionCard
            title={ENTRY_SECTION_LABELS.internships}
            hint="Praktika – gleiche Felder wie Berufserfahrung"
            entries={draft.internships.items}
            onChange={(id, patch) => setEntry("internships", id, patch)}
            onAdd={() => addEntry("internships")}
            onRemove={(id) => removeEntry("internships", id)}
          />
          <EntrySectionCard
            title={ENTRY_SECTION_LABELS.education}
            hint="Schulbildung/Ausbildung – Abschluss, Einrichtung, Zeitraum"
            entries={draft.education.items}
            onChange={(id, patch) => setEntry("education", id, patch)}
            onAdd={() => addEntry("education")}
            onRemove={(id) => removeEntry("education", id)}
          />

          <Card>
            <CardHeader>
              <CardTitle>Kenntnisse</CardTitle>
              <CardDescription>Werden zweispaltig dargestellt</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {draft.skills.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={s.name}
                    onChange={(e) => setSkill(i, e.target.value)}
                    placeholder="z. B. E-Commerce & Online-Shop-Management"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => removeSkill(i)} aria-label="Kenntnis entfernen">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addSkill}>
                <Plus className="h-4 w-4" /> Kenntnis hinzufügen
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sprachen</CardTitle>
              <CardDescription>Name, Niveau und optionale Beschreibung – werden dreispaltig dargestellt</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {draft.languages.map((l, i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <Input value={l.name} onChange={(e) => setLanguage(i, { name: e.target.value })} placeholder="Arabisch" />
                    <Input value={l.level} onChange={(e) => setLanguage(i, { level: e.target.value })} placeholder="Muttersprache / B2 / …" />
                    <Button type="button" variant="outline" size="icon" onClick={() => removeLanguage(i)} aria-label="Sprache entfernen">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    value={l.description}
                    onChange={(e) => setLanguage(i, { description: e.target.value })}
                    placeholder="Optionale Beschreibung (nur für Referenz/Ausdruck optional)"
                  />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addLanguage}>
                <Plus className="h-4 w-4" /> Sprache hinzufügen
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── Controls + preview ── */}
        <div className="space-y-4 lg:col-span-2">
          <div className="space-y-4 lg:sticky lg:top-6">
            <Card>
              <CardHeader>
                <CardTitle>Vorlage & Export</CardTitle>
                <CardDescription>Die Referenz-Vorlage ist die Standard-Vorlage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2.5">
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
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
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
                          className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                            options.accentColor === c ? "border-slate-900" : "border-transparent"
                          }`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
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

                <div>
                  <Label htmlFor="cv-title">Titel der gespeicherten Version</Label>
                  <Input id="cv-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" onClick={handleSave} loading={pending}>
                    <Save className="h-4 w-4" /> Speichern
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={handleDownload} loading={pending}>
                    <Download className="h-4 w-4" /> PDF laden
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  PDF wird direkt im Browser erzeugt (jsPDF) mit auswählbarem Text – keine Daten verlassen dein Gerät.
                </p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Live-Vorschau</CardTitle>
                  <CardDescription>
                    Vorlage „{CV_TEMPLATES.find((t) => t.id === options.template)?.label}“ · A4
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto rounded-lg border border-border bg-slate-200/60 p-3">
                  <div className="min-w-[620px]">
                    <CvPreview data={draft} options={options} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {saved.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Gespeicherte Versionen</CardTitle>
                  <CardDescription>{saved.length} gespeichert</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {saved.map((cv) => (
                    <div key={cv.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">{cv.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {cv.template} · {new Date(cv.updated_at).toLocaleDateString("de-DE")}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLoad(cv)}
                          aria-label={`Version laden: ${cv.title}`}
                        >
                          <FolderOpen className="h-4 w-4" /> Laden
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            startTransition(async () => {
                              setError(null);
                              setNotice(null);
                              const result = await deleteCvDocument(cv.id);
                              if (!result.ok) {
                                setError(result.error ?? "Löschen fehlgeschlagen.");
                                return;
                              }
                              setNotice("Version gelöscht.");
                              router.refresh();
                            })
                          }
                          aria-label="Löschen"
                        >
                          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm text-slate-700">{label}</Label>
      {children}
    </div>
  );
}

function EntrySectionCard({
  title,
  hint,
  entries,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  hint: string;
  entries: CvEntry[];
  onChange: (id: string, patch: Partial<CvEntry>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{hint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.length === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Noch keine Einträge.
          </p>
        )}
        {entries.map((e) => (
          <div key={e.id} className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Position / Rolle</Label>
                <Input
                  value={e.role}
                  onChange={(ev) => onChange(e.id, { role: ev.target.value })}
                  placeholder="Selbstständig – E-Commerce"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Firma / Einrichtung</Label>
                <Input
                  value={e.company}
                  onChange={(ev) => onChange(e.id, { company: ev.target.value })}
                  placeholder="MainThèrm SARL"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Von</Label>
                <Input
                  value={e.startDate}
                  onChange={(ev) => onChange(e.id, { startDate: ev.target.value })}
                  placeholder="2024"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Bis</Label>
                <Input
                  value={e.endDate}
                  onChange={(ev) => onChange(e.id, { endDate: ev.target.value })}
                  placeholder="2025"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Ort</Label>
                <Input
                  value={e.location}
                  onChange={(ev) => onChange(e.id, { location: ev.target.value })}
                  placeholder="Casablanca"
                />
              </div>
              <div className="flex items-end pb-1">
                <Button type="button" variant="outline" size="icon" onClick={() => onRemove(e.id)} aria-label="Eintrag entfernen">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={e.current}
                onChange={(ev) => onChange(e.id, { current: ev.target.checked })}
                className="h-4 w-4 rounded accent-blue-600"
              />
              Aktuell („– heute“)
            </label>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Beschreibung / Stichpunkte (eine pro Zeile)</Label>
              <Textarea
                value={e.description}
                onChange={(ev) => onChange(e.id, { description: ev.target.value })}
                rows={4}
                placeholder={"Betreuung von Kundenanfragen per E-Mail und Chat\nBearbeitung von Bestellungen und Retouren"}
              />
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4" /> Eintrag hinzufügen
        </Button>
      </CardContent>
    </Card>
  );
}
