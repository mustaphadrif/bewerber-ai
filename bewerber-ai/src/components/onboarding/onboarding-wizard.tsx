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
import { ONBOARDING_STEPS, type OnboardingStepId } from "@/lib/cv";
import type { FullProfile } from "@/lib/profile";
import {
  saveOnboardingStep,
  completeOnboarding,
  addExperience,
  deleteExperience,
  addEducation,
  deleteEducation,
  addLanguage,
  deleteLanguage,
  addSkill,
  deleteSkill,
  type ActionResult,
} from "@/lib/profile";
import { Check, Plus, Trash2, ArrowLeft, ArrowRight } from "lucide-react";

const STEP_IDS = ONBOARDING_STEPS.map((s) => s.id);
const LANGUAGE_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "Muttersprache"];

export function OnboardingWizard({ initial }: { initial: FullProfile }) {
  const router = useRouter();
  const p = initial.profile;
  const savedStep = Math.min(Math.max(p?.onboarding_step ?? 1, 1), 6);

  const [step, setStep] = useState<number>(p?.onboarding_completed ? 6 : savedStep);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [pending, startTransition] = useTransition();

  const stepId = STEP_IDS[step - 1] as OnboardingStepId;

  function run(action: () => Promise<ActionResult>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1600);
      onOk?.();
    });
  }

  function goTo(next: number) {
    setStep(Math.max(1, Math.min(6, next)));
    router.refresh();
  }

  function handleFinish() {
    run(
      () => completeOnboarding(),
      () => {
        router.push("/dashboard");
        router.refresh();
      }
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dein Profil in 6 Schritten</h1>
        <p className="mt-2 text-muted-foreground">
          Jeder Schritt wird sofort gespeichert – du kannst jederzeit fortsetzen.
        </p>
      </div>

      {/* Stepper */}
      <div className="mb-8 flex items-center justify-between gap-1 sm:gap-2">
        {ONBOARDING_STEPS.map((s, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <div key={s.id} className="flex flex-1 flex-col items-center gap-1.5">
              <button
                onClick={() => goTo(n)}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors sm:h-10 sm:w-10 ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "bg-primary/10 text-primary ring-2 ring-primary/30"
                      : "bg-muted text-muted-foreground"
                }`}
                aria-label={s.title}
              >
                {done ? <Check className="h-4 w-4" /> : n}
              </button>
              <span className={`hidden text-center text-[11px] leading-tight sm:block ${active ? "font-medium text-primary" : "text-muted-foreground"}`}>
                {s.short}
              </span>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{ONBOARDING_STEPS[step - 1].title}</CardTitle>
          <CardDescription>
            {savedFlash ? "Gespeichert ✓" : "Änderungen werden beim Weiterklicken gespeichert."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && <Alert variant="error">{error}</Alert>}

          {stepId === "person" && (
            <StepPerson
              key={p?.id ?? "person"}
              initial={p}
              onSave={(patch) =>
                run(() => saveOnboardingStep(1, patch), () => goTo(2))
              }
            />
          )}
          {stepId === "kontakt" && (
            <StepKontakt
              key={p?.id ?? "kontakt"}
              initial={p}
              onSave={(patch) =>
                run(() => saveOnboardingStep(2, patch), () => goTo(3))
              }
            />
          )}
          {stepId === "beruf" && (
            <StepBeruf
              key={p?.id ?? "beruf"}
              initial={p}
              onSave={(patch) =>
                run(() => saveOnboardingStep(3, patch), () => goTo(4))
              }
            />
          )}
          {stepId === "erfahrung" && (
            <StepErfahrung
              items={initial.experience}
              addAction={(input) => run(() => addExperience(input))}
              deleteAction={(id) => run(() => deleteExperience(id))}
              onNext={() => goTo(5)}
            />
          )}
          {stepId === "bildung" && (
            <StepBildung
              items={initial.education}
              languages={initial.languages}
              addEducationAction={(input) => run(() => addEducation(input))}
              deleteEducationAction={(id) => run(() => deleteEducation(id))}
              addLanguageAction={(input) => run(() => addLanguage(input))}
              deleteLanguageAction={(id) => run(() => deleteLanguage(id))}
              onNext={() => goTo(6)}
            />
          )}
          {stepId === "faehigkeiten" && (
            <StepFaehigkeiten
              items={initial.skills}
              addSkillAction={(input) => run(() => addSkill(input))}
              deleteSkillAction={(id) => run(() => deleteSkill(id))}
              onFinish={handleFinish}
              pending={pending}
            />
          )}

          {stepId !== "erfahrung" && stepId !== "bildung" && stepId !== "faehigkeiten" && (
            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => goTo(step - 1)} disabled={step <= 1} loading={pending}>
                <ArrowLeft className="h-4 w-4" /> Zurück
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => goTo(step + 1)} loading={pending}>
                  Überspringen
                </Button>
                <Button type="submit" form={`onb-step-${stepId}`} loading={pending}>
                  Weiter <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type ProfilePatch = Parameters<typeof saveOnboardingStep>[1];

function StepPerson({
  initial,
  onSave,
}: {
  initial: FullProfile["profile"];
  onSave: (patch: ProfilePatch) => void;
}) {
  const [form, setForm] = useState({
    first_name: initial?.first_name ?? "",
    last_name: initial?.last_name ?? "",
    birth_date: initial?.birth_date ?? "",
    job_title: initial?.job_title ?? "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form
      id="onb-step-person"
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          first_name: form.first_name || null,
          last_name: form.last_name || null,
          birth_date: form.birth_date || null,
          job_title: form.job_title || null,
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="first_name">Vorname *</Label>
          <Input id="first_name" value={form.first_name} onChange={set("first_name")} placeholder="Max" required />
        </div>
        <div>
          <Label htmlFor="last_name">Nachname *</Label>
          <Input id="last_name" value={form.last_name} onChange={set("last_name")} placeholder="Mustermann" required />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="birth_date">Geburtsdatum</Label>
          <Input id="birth_date" type="date" value={form.birth_date} onChange={set("birth_date")} />
        </div>
        <div>
          <Label htmlFor="job_title">Aktuelle / angestrebte Position</Label>
          <Input id="job_title" value={form.job_title} onChange={set("job_title")} placeholder="z. B. Product Manager" />
        </div>
      </div>
    </form>
  );
}

function StepKontakt({
  initial,
  onSave,
}: {
  initial: FullProfile["profile"];
  onSave: (patch: ProfilePatch) => void;
}) {
  const [form, setForm] = useState({
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    address: initial?.address ?? "",
    city: initial?.city ?? "",
    postal_code: initial?.postal_code ?? "",
    country: initial?.country ?? "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form
      id="onb-step-kontakt"
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          email: form.email || null,
          phone: form.phone || null,
          address: form.address || null,
          city: form.city || null,
          postal_code: form.postal_code || null,
          country: form.country || null,
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="email">E-Mail *</Label>
          <Input id="email" type="email" value={form.email} onChange={set("email")} placeholder="max@beispiel.de" required />
        </div>
        <div>
          <Label htmlFor="phone">Telefon</Label>
          <Input id="phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="+49 170 1234567" />
        </div>
      </div>
      <div>
        <Label htmlFor="address">Straße & Hausnummer</Label>
        <Input id="address" value={form.address} onChange={set("address")} placeholder="Musterstraße 1" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="postal_code">PLZ</Label>
          <Input id="postal_code" value={form.postal_code} onChange={set("postal_code")} placeholder="10115" />
        </div>
        <div className="sm:col-span-1">
          <Label htmlFor="city">Stadt</Label>
          <Input id="city" value={form.city} onChange={set("city")} placeholder="Berlin" />
        </div>
        <div>
          <Label htmlFor="country">Land</Label>
          <Input id="country" value={form.country} onChange={set("country")} placeholder="Deutschland" />
        </div>
      </div>
    </form>
  );
}

function StepBeruf({
  initial,
  onSave,
}: {
  initial: FullProfile["profile"];
  onSave: (patch: ProfilePatch) => void;
}) {
  const [form, setForm] = useState({
    headline: initial?.headline ?? "",
    about: initial?.about ?? "",
  });

  return (
    <form
      id="onb-step-beruf"
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ headline: form.headline || null, about: form.about || null });
      }}
    >
      <div>
        <Label htmlFor="headline">Headline / Kurzbeschreibung</Label>
        <Input
          id="headline"
          value={form.headline}
          onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
          placeholder="z. B. Senior Product Manager mit 8 Jahren Erfahrung im E-Commerce"
        />
      </div>
      <div>
        <Label htmlFor="about">Über mich</Label>
        <Textarea
          id="about"
          rows={6}
          value={form.about}
          onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))}
          placeholder="Erzähle kurz von deinem Werdegang, deinen Stärken und Zielen – nur verifizierte Fakten."
        />
      </div>
    </form>
  );
}

/* ── Reusable list editors ─────────────────────────────────────────────── */

function StepErfahrung({
  items,
  addAction,
  deleteAction,
  onNext,
}: {
  items: FullProfile["experience"];
  addAction: (input: Parameters<typeof addExperience>[0]) => void;
  deleteAction: (id: string) => void;
  onNext: () => void;
}) {
  const [form, setForm] = useState({
    company: "",
    position: "",
    location: "",
    start_date: "",
    end_date: "",
    current: false,
    description: "",
  });
  const canAdd = form.company.trim() && form.position.trim();

  function submit() {
    if (!canAdd) return;
    addAction({
      company: form.company.trim(),
      position: form.position.trim(),
      location: form.location || null,
      start_date: form.start_date || null,
      end_date: form.current ? null : form.end_date || null,
      current: form.current,
      description: form.description || null,
    });
    setForm({ company: "", position: "", location: "", start_date: "", end_date: "", current: false, description: "" });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="Unternehmen *" />
        <Input value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} placeholder="Position *" />
        <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Ort" />
        <div className="flex items-center gap-2">
          <input
            id="exp-current"
            type="checkbox"
            checked={form.current}
            onChange={(e) => setForm((f) => ({ ...f, current: e.target.checked }))}
            className="h-4 w-4 rounded border-input accent-blue-600"
          />
          <label htmlFor="exp-current" className="text-sm text-slate-700">Aktuelle Tätigkeit</label>
        </div>
        <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} placeholder="Beginn" />
        <Input type="date" value={form.end_date} disabled={form.current} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} placeholder="Ende" />
        <Textarea className="sm:col-span-2" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Kurzbeschreibung (optional)" />
      </div>
      <Button type="button" variant="outline" size="sm" disabled={!canAdd} onClick={submit}>
        <Plus className="h-4 w-4" /> Erfahrung hinzufügen
      </Button>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-slate-900">{item.position}</div>
                <div className="text-xs text-muted-foreground">
                  {item.company}
                  {item.location ? ` · ${item.location}` : ""}
                  {item.start_date ? ` · ${item.start_date.slice(0, 4)}–${item.current ? "heute" : (item.end_date ?? "")?.slice(0, 4)}` : ""}
                </div>
              </div>
              <button onClick={() => deleteAction(item.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600" aria-label="Löschen">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="button" onClick={onNext}>
          Weiter <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepBildung({
  items,
  languages,
  addEducationAction,
  deleteEducationAction,
  addLanguageAction,
  deleteLanguageAction,
  onNext,
}: {
  items: FullProfile["education"];
  languages: FullProfile["languages"];
  addEducationAction: (input: Parameters<typeof addEducation>[0]) => void;
  deleteEducationAction: (id: string) => void;
  addLanguageAction: (input: Parameters<typeof addLanguage>[0]) => void;
  deleteLanguageAction: (id: string) => void;
  onNext: () => void;
}) {
  const [edu, setEdu] = useState({ institution: "", degree: "", field_of_study: "", end_date: "" });
  const [lang, setLang] = useState({ name: "", level: "B2" });

  function addEdu() {
    if (!edu.institution.trim()) return;
    addEducationAction({
      institution: edu.institution.trim(),
      degree: edu.degree || null,
      field_of_study: edu.field_of_study || null,
      start_date: null,
      end_date: edu.end_date || null,
      grade: null,
      description: null,
    });
    setEdu({ institution: "", degree: "", field_of_study: "", end_date: "" });
  }
  function addLang() {
    if (!lang.name.trim()) return;
    addLanguageAction({ name: lang.name.trim(), level: lang.level });
    setLang({ name: "", level: "B2" });
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-800">Ausbildung</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={edu.institution} onChange={(e) => setEdu((f) => ({ ...f, institution: e.target.value }))} placeholder="Hochschule / Schule *" />
          <Input value={edu.degree} onChange={(e) => setEdu((f) => ({ ...f, degree: e.target.value }))} placeholder="Abschluss (z. B. Bachelor)" />
          <Input value={edu.field_of_study} onChange={(e) => setEdu((f) => ({ ...f, field_of_study: e.target.value }))} placeholder="Studienfach" />
          <Input type="date" value={edu.end_date} onChange={(e) => setEdu((f) => ({ ...f, end_date: e.target.value }))} placeholder="Abschlussdatum" />
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-3" disabled={!edu.institution.trim()} onClick={addEdu}>
          <Plus className="h-4 w-4" /> Ausbildung hinzufügen
        </Button>
        {items.length > 0 && (
          <div className="mt-3 space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">{item.degree || "Abschluss"} · {item.institution}</div>
                  <div className="text-xs text-muted-foreground">{item.field_of_study}{item.end_date ? ` · ${item.end_date.slice(0, 4)}` : ""}</div>
                </div>
                <button onClick={() => deleteEducationAction(item.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600" aria-label="Löschen">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-800">Sprachen</h4>
        <div className="flex flex-wrap gap-3">
          <Input className="w-48" value={lang.name} onChange={(e) => setLang((f) => ({ ...f, name: e.target.value }))} placeholder="z. B. Englisch" />
          <Select className="w-40" value={lang.level} onChange={(e) => setLang((f) => ({ ...f, level: e.target.value }))}>
            {LANGUAGE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
          <Button type="button" variant="outline" size="sm" disabled={!lang.name.trim()} onClick={addLang}>
            <Plus className="h-4 w-4" /> Hinzufügen
          </Button>
        </div>
        {languages.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {languages.map((l) => (
              <span key={l.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-sm">
                {l.name} · <span className="text-xs text-muted-foreground">{l.level}</span>
                <button onClick={() => deleteLanguageAction(l.id)} className="text-muted-foreground hover:text-red-600" aria-label="Löschen">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button type="button" onClick={onNext}>
          Weiter <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepFaehigkeiten({
  items,
  addSkillAction,
  deleteSkillAction,
  onFinish,
  pending,
}: {
  items: FullProfile["skills"];
  addSkillAction: (input: Parameters<typeof addSkill>[0]) => void;
  deleteSkillAction: (id: string) => void;
  onFinish: () => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState(3);

  function add() {
    if (!name.trim()) return;
    addSkillAction({ name: name.trim(), level });
    setName("");
    setLevel(3);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Label htmlFor="skill-name">Fähigkeit</Label>
          <Input id="skill-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Projektmanagement" />
        </div>
        <div>
          <Label htmlFor="skill-level">Level (1–5)</Label>
          <Select id="skill-level" className="w-32" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </div>
        <Button type="button" variant="outline" disabled={!name.trim()} onClick={add}>
          <Plus className="h-4 w-4" /> Hinzufügen
        </Button>
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-sm">
              {s.name}
              <span className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={`h-1.5 w-1.5 rounded-full ${n <= s.level ? "bg-primary" : "bg-slate-200"}`} />
                ))}
              </span>
              <button onClick={() => deleteSkillAction(s.id)} className="text-muted-foreground hover:text-red-600" aria-label="Löschen">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="button" onClick={onFinish} loading={pending} size="lg">
          Onboarding abschließen <Check className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

