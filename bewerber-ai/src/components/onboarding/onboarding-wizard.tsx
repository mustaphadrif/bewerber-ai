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
import { useI18n } from "@/lib/i18n/client";
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
  const { t } = useI18n();
  const p = initial.profile;
  const savedStep = Math.min(Math.max(p?.onboarding_step ?? 1, 1), 6);

  const [step, setStep] = useState<number>(p?.onboarding_completed ? 6 : savedStep);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [pending, startTransition] = useTransition();

  const stepId = STEP_IDS[step - 1] as OnboardingStepId;
  const currentStep = ONBOARDING_STEPS[step - 1];

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
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("onboarding.title")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t("onboarding.subtitle")}
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
                aria-label={t(`onboarding.steps.${s.id}.title`)}
              >
                {done ? <Check className="h-4 w-4" /> : n}
              </button>
              <span className={`hidden text-center text-[11px] leading-tight sm:block ${active ? "font-medium text-primary" : "text-muted-foreground"}`}>
                {t(`onboarding.steps.${s.id}.short`)}
              </span>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t(`onboarding.steps.${currentStep.id}.title`)}</CardTitle>
          <CardDescription>
            {savedFlash ? t("onboarding.savedFlash") : t("onboarding.changesSaved")}
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
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t("common.back")}
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => goTo(step + 1)} loading={pending}>
                  {t("common.skip")}
                </Button>
                <Button type="submit" form={`onb-step-${stepId}`} loading={pending}>
                  {t("common.next")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
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
  const { t } = useI18n();
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
          <Label htmlFor="first_name">{t("onboarding.firstName")}</Label>
          <Input id="first_name" value={form.first_name} onChange={set("first_name")} placeholder={t("onboarding.firstNamePh")} required />
        </div>
        <div>
          <Label htmlFor="last_name">{t("onboarding.lastName")}</Label>
          <Input id="last_name" value={form.last_name} onChange={set("last_name")} placeholder={t("onboarding.lastNamePh")} required />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="birth_date">{t("onboarding.birthDate")}</Label>
          <Input id="birth_date" type="date" value={form.birth_date} onChange={set("birth_date")} />
        </div>
        <div>
          <Label htmlFor="job_title">{t("onboarding.position")}</Label>
          <Input id="job_title" value={form.job_title} onChange={set("job_title")} placeholder={t("onboarding.positionPh")} />
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
  const { t } = useI18n();
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
          <Label htmlFor="email">{t("onboarding.email")}</Label>
          <Input id="email" type="email" value={form.email} onChange={set("email")} placeholder={t("onboarding.emailPh")} required />
        </div>
        <div>
          <Label htmlFor="phone">{t("onboarding.phone")}</Label>
          <Input id="phone" type="tel" value={form.phone} onChange={set("phone")} placeholder={t("onboarding.phonePh")} />
        </div>
      </div>
      <div>
        <Label htmlFor="address">{t("onboarding.street")}</Label>
        <Input id="address" value={form.address} onChange={set("address")} placeholder={t("onboarding.streetPh")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="postal_code">{t("onboarding.postalCode")}</Label>
          <Input id="postal_code" value={form.postal_code} onChange={set("postal_code")} placeholder={t("onboarding.postalCodePh")} />
        </div>
        <div className="sm:col-span-1">
          <Label htmlFor="city">{t("onboarding.city")}</Label>
          <Input id="city" value={form.city} onChange={set("city")} placeholder={t("onboarding.cityPh")} />
        </div>
        <div>
          <Label htmlFor="country">{t("onboarding.country")}</Label>
          <Input id="country" value={form.country} onChange={set("country")} placeholder={t("onboarding.countryPh")} />
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
  const { t } = useI18n();
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
        <Label htmlFor="headline">{t("onboarding.headline")}</Label>
        <Input
          id="headline"
          value={form.headline}
          onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
          placeholder={t("onboarding.headlinePh")}
        />
      </div>
      <div>
        <Label htmlFor="about">{t("onboarding.about")}</Label>
        <Textarea
          id="about"
          rows={6}
          value={form.about}
          onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))}
          placeholder={t("onboarding.aboutPh")}
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
  const { t } = useI18n();
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
        <Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder={t("onboarding.companyPh")} />
        <Input value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} placeholder={t("onboarding.positionPh2")} />
        <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder={t("onboarding.location")} />
        <div className="flex items-center gap-2">
          <input
            id="exp-current"
            type="checkbox"
            checked={form.current}
            onChange={(e) => setForm((f) => ({ ...f, current: e.target.checked }))}
            className="h-4 w-4 rounded border-input accent-blue-600"
          />
          <label htmlFor="exp-current" className="text-sm text-slate-700">{t("onboarding.currentRole")}</label>
        </div>
        <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} placeholder={t("onboarding.startDate")} />
        <Input type="date" value={form.end_date} disabled={form.current} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} placeholder={t("onboarding.endDate")} />
        <Textarea className="sm:col-span-2" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={t("onboarding.shortDescription")} />
      </div>
      <Button type="button" variant="outline" size="sm" disabled={!canAdd} onClick={submit}>
        <Plus className="h-4 w-4" /> {t("onboarding.addExperience")}
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
                  {item.start_date ? ` · ${item.start_date.slice(0, 4)}–${item.current ? t("common.today") : (item.end_date ?? "")?.slice(0, 4)}` : ""}
                </div>
              </div>
              <button onClick={() => deleteAction(item.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600" aria-label={t("onboarding.deleteAria")}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="button" onClick={onNext}>
          {t("common.next")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
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
  const { t } = useI18n();
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
        <h4 className="mb-2 text-sm font-semibold text-slate-800">{t("onboarding.education")}</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input value={edu.institution} onChange={(e) => setEdu((f) => ({ ...f, institution: e.target.value }))} placeholder={t("onboarding.institution")} />
          <Input value={edu.degree} onChange={(e) => setEdu((f) => ({ ...f, degree: e.target.value }))} placeholder={t("onboarding.degree")} />
          <Input value={edu.field_of_study} onChange={(e) => setEdu((f) => ({ ...f, field_of_study: e.target.value }))} placeholder={t("onboarding.fieldOfStudy")} />
          <Input type="date" value={edu.end_date} onChange={(e) => setEdu((f) => ({ ...f, end_date: e.target.value }))} placeholder={t("onboarding.graduationDate")} />
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-3" disabled={!edu.institution.trim()} onClick={addEdu}>
          <Plus className="h-4 w-4" /> {t("onboarding.addEducation")}
        </Button>
        {items.length > 0 && (
          <div className="mt-3 space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">{item.degree || t("onboarding.degreeShort")} · {item.institution}</div>
                  <div className="text-xs text-muted-foreground">{item.field_of_study}{item.end_date ? ` · ${item.end_date.slice(0, 4)}` : ""}</div>
                </div>
                <button onClick={() => deleteEducationAction(item.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600" aria-label={t("onboarding.deleteAria")}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-slate-800">{t("onboarding.languages")}</h4>
        <div className="flex flex-wrap gap-3">
          <Input className="w-48" value={lang.name} onChange={(e) => setLang((f) => ({ ...f, name: e.target.value }))} placeholder={t("onboarding.languagePh")} />
          <Select className="w-40" value={lang.level} onChange={(e) => setLang((f) => ({ ...f, level: e.target.value }))}>
            {LANGUAGE_LEVELS.map((l) => <option key={l} value={l}>{l === "Muttersprache" ? t("onboarding.motherTongue") : l}</option>)}
          </Select>
          <Button type="button" variant="outline" size="sm" disabled={!lang.name.trim()} onClick={addLang}>
            <Plus className="h-4 w-4" /> {t("onboarding.add")}
          </Button>
        </div>
        {languages.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {languages.map((l) => (
              <span key={l.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-sm">
                {l.name} · <span className="text-xs text-muted-foreground">{l.level === "Muttersprache" ? t("onboarding.motherTongue") : l.level}</span>
                <button onClick={() => deleteLanguageAction(l.id)} className="text-muted-foreground hover:text-red-600" aria-label={t("onboarding.deleteAria")}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button type="button" onClick={onNext}>
          {t("common.next")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
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
  const { t } = useI18n();
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
          <Label htmlFor="skill-name">{t("onboarding.skill")}</Label>
          <Input id="skill-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("onboarding.skillPh")} />
        </div>
        <div>
          <Label htmlFor="skill-level">{t("onboarding.level")}</Label>
          <Select id="skill-level" className="w-32" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </div>
        <Button type="button" variant="outline" disabled={!name.trim()} onClick={add}>
          <Plus className="h-4 w-4" /> {t("onboarding.add")}
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
              <button onClick={() => deleteSkillAction(s.id)} className="text-muted-foreground hover:text-red-600" aria-label={t("onboarding.deleteAria")}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="button" onClick={onFinish} loading={pending} size="lg">
          {t("onboarding.complete")} <Check className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
