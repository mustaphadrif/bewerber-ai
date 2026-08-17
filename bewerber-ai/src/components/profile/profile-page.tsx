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
  upsertProfile,
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
import { Progress } from "@/components/ui/progress";
import { Check, Plus, Trash2 } from "lucide-react";

const LANGUAGE_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "Muttersprache"];

export function ProfilePage({ full }: { full: FullProfile }) {
  const router = useRouter();
  const { t } = useI18n();
  const p = full.profile;
  const completion = profileCompletion(full);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState({
    first_name: p?.first_name ?? "",
    last_name: p?.last_name ?? "",
    email: p?.email ?? "",
    phone: p?.phone ?? "",
    address: p?.address ?? "",
    city: p?.city ?? "",
    postal_code: p?.postal_code ?? "",
    country: p?.country ?? "",
    birth_date: p?.birth_date ?? "",
    job_title: p?.job_title ?? "",
    headline: p?.headline ?? "",
    about: p?.about ?? "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
      router.refresh();
    });
  }

  function saveBasics() {
    run(() =>
      upsertProfile({
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        city: form.city || null,
        postal_code: form.postal_code || null,
        country: form.country || null,
        birth_date: form.birth_date || null,
        job_title: form.job_title || null,
        headline: form.headline || null,
        about: form.about || null,
      })
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("profile.title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("profile.subtitle")}</p>
        </div>
        <div className="w-full max-w-xs">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{t("profile.completeness")}</span><span className="font-semibold text-primary">{completion}%</span>
          </div>
          <Progress value={completion} className="h-2" />
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.personalData")}</CardTitle>
          <CardDescription>{saved ? t("profile.saved") : t("profile.basicsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="p-first">{t("profile.firstName")}</Label><Input id="p-first" value={form.first_name} onChange={set("first_name")} /></div>
            <div><Label htmlFor="p-last">{t("profile.lastName")}</Label><Input id="p-last" value={form.last_name} onChange={set("last_name")} /></div>
            <div><Label htmlFor="p-email">{t("profile.email")}</Label><Input id="p-email" type="email" value={form.email} onChange={set("email")} /></div>
            <div><Label htmlFor="p-phone">{t("profile.phone")}</Label><Input id="p-phone" type="tel" value={form.phone} onChange={set("phone")} /></div>
            <div><Label htmlFor="p-birth">{t("profile.birthDate")}</Label><Input id="p-birth" type="date" value={form.birth_date} onChange={set("birth_date")} /></div>
            <div><Label htmlFor="p-job">{t("profile.position")}</Label><Input id="p-job" value={form.job_title} onChange={set("job_title")} /></div>
            <div className="sm:col-span-2"><Label htmlFor="p-address">{t("profile.address")}</Label><Input id="p-address" value={form.address} onChange={set("address")} /></div>
            <div><Label htmlFor="p-plz">{t("profile.postalCode")}</Label><Input id="p-plz" value={form.postal_code} onChange={set("postal_code")} /></div>
            <div><Label htmlFor="p-city">{t("profile.city")}</Label><Input id="p-city" value={form.city} onChange={set("city")} /></div>
            <div><Label htmlFor="p-country">{t("profile.country")}</Label><Input id="p-country" value={form.country} onChange={set("country")} /></div>
            <div className="sm:col-span-2"><Label htmlFor="p-headline">{t("profile.headline")}</Label><Input id="p-headline" value={form.headline} onChange={set("headline")} placeholder={t("profile.headlinePh")} /></div>
            <div className="sm:col-span-2"><Label htmlFor="p-about">{t("profile.about")}</Label><Textarea id="p-about" rows={4} value={form.about} onChange={set("about")} /></div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveBasics} loading={pending}>{saved ? <Check className="h-4 w-4" /> : null} {t("common.save")}</Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-2">
        <ExperienceEditor full={full} run={run} />
        <EducationEditor full={full} run={run} />
        <LanguagesEditor full={full} run={run} />
        <SkillsEditor full={full} run={run} />
      </div>
    </div>
  );
}

function ExperienceEditor({ full, run }: { full: FullProfile; run: (a: () => Promise<ActionResult>) => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ company: "", position: "", location: "", start_date: "", end_date: "", current: false, description: "" });
  return (
    <Card>
      <CardHeader><CardTitle>{t("profile.experience")}</CardTitle><CardDescription>{t("profile.entriesCount", { count: full.experience.length })}</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder={t("profile.companyPh")} />
          <Input value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} placeholder={t("profile.positionPh")} />
          <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder={t("profile.locationPh")} />
          <div className="flex items-center gap-2">
            <input id="exp-current-p" type="checkbox" checked={form.current} onChange={(e) => setForm((f) => ({ ...f, current: e.target.checked }))} className="h-4 w-4 rounded accent-blue-600" />
            <label htmlFor="exp-current-p" className="text-sm text-slate-700">{t("profile.current")}</label>
          </div>
          <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
          <Input type="date" value={form.end_date} disabled={form.current} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
          <Textarea className="sm:col-span-2" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={t("profile.descriptionPh")} />
        </div>
        <Button variant="outline" size="sm" disabled={!form.company.trim() || !form.position.trim()} onClick={() => {
          run(() => addExperience({
            company: form.company.trim(), position: form.position.trim(), location: form.location || null,
            start_date: form.start_date || null, end_date: form.current ? null : form.end_date || null,
            current: form.current, description: form.description || null,
          }));
          setForm({ company: "", position: "", location: "", start_date: "", end_date: "", current: false, description: "" });
        }}>
          <Plus className="h-4 w-4" /> {t("common.add")}
        </Button>
        {full.experience.map((e) => (
          <div key={e.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
            <div>
              <div className="text-sm font-medium">{e.position} · {e.company}</div>
              <div className="text-xs text-muted-foreground">
                {e.start_date ? `${e.start_date.slice(0, 4)}–${e.current ? t("common.today") : (e.end_date ?? "")?.slice(0, 4)}` : ""}
                {e.location ? ` · ${e.location}` : ""}
              </div>
            </div>
            <button onClick={() => run(() => deleteExperience(e.id))} className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600" aria-label={t("profile.deleteAria")}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EducationEditor({ full, run }: { full: FullProfile; run: (a: () => Promise<ActionResult>) => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ institution: "", degree: "", field_of_study: "", end_date: "" });
  return (
    <Card>
      <CardHeader><CardTitle>{t("profile.education")}</CardTitle><CardDescription>{t("profile.entriesCount", { count: full.education.length })}</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={form.institution} onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))} placeholder={t("profile.institutionPh")} />
          <Input value={form.degree} onChange={(e) => setForm((f) => ({ ...f, degree: e.target.value }))} placeholder={t("profile.degreePh")} />
          <Input value={form.field_of_study} onChange={(e) => setForm((f) => ({ ...f, field_of_study: e.target.value }))} placeholder={t("profile.fieldOfStudyPh")} />
          <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
        </div>
        <Button variant="outline" size="sm" disabled={!form.institution.trim()} onClick={() => {
          run(() => addEducation({
            institution: form.institution.trim(), degree: form.degree || null, field_of_study: form.field_of_study || null,
            start_date: null, end_date: form.end_date || null, grade: null, description: null,
          }));
          setForm({ institution: "", degree: "", field_of_study: "", end_date: "" });
        }}>
          <Plus className="h-4 w-4" /> {t("common.add")}
        </Button>
        {full.education.map((e) => (
          <div key={e.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
            <div>
              <div className="text-sm font-medium">{e.degree || t("onboarding.degreeShort")} · {e.institution}</div>
              <div className="text-xs text-muted-foreground">{e.field_of_study}{e.end_date ? ` · ${e.end_date.slice(0, 4)}` : ""}</div>
            </div>
            <button onClick={() => run(() => deleteEducation(e.id))} className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600" aria-label={t("profile.deleteAria")}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function LanguagesEditor({ full, run }: { full: FullProfile; run: (a: () => Promise<ActionResult>) => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: "", level: "B2" });
  return (
    <Card>
      <CardHeader><CardTitle>{t("profile.languages")}</CardTitle><CardDescription>{t("profile.languagesCount", { count: full.languages.length })}</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input className="w-44" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("profile.languagePh")} />
          <Select className="w-36" value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}>
            {LANGUAGE_LEVELS.map((l) => <option key={l} value={l}>{l === "Muttersprache" ? t("onboarding.motherTongue") : l}</option>)}
          </Select>
          <Button variant="outline" size="sm" disabled={!form.name.trim()} onClick={() => {
            run(() => addLanguage({ name: form.name.trim(), level: form.level }));
            setForm({ name: "", level: "B2" });
          }}>
            <Plus className="h-4 w-4" /> {t("common.add")}
          </Button>
        </div>
        {full.languages.map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
            <span className="text-sm">{l.name} <span className="text-xs text-muted-foreground">· {l.level === "Muttersprache" ? t("onboarding.motherTongue") : l.level}</span></span>
            <button onClick={() => run(() => deleteLanguage(l.id))} className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600" aria-label={t("profile.deleteAria")}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SkillsEditor({ full, run }: { full: FullProfile; run: (a: () => Promise<ActionResult>) => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: "", level: 3 });
  return (
    <Card>
      <CardHeader><CardTitle>{t("profile.skills")}</CardTitle><CardDescription>{t("profile.skillsCount", { count: full.skills.length })}</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input className="w-44" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("profile.skillPh")} />
          <Select className="w-32" value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: Number(e.target.value) }))}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{t("profile.level", { n })}</option>)}
          </Select>
          <Button variant="outline" size="sm" disabled={!form.name.trim()} onClick={() => {
            run(() => addSkill({ name: form.name.trim(), level: form.level }));
            setForm({ name: "", level: 3 });
          }}>
            <Plus className="h-4 w-4" /> {t("common.add")}
          </Button>
        </div>
        {full.skills.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
            <span className="text-sm">{s.name}</span>
            <span className="flex items-center gap-2">
              <span className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-1.5 w-1.5 rounded-full ${n <= s.level ? "bg-primary" : "bg-slate-200"}`} />)}
              </span>
              <button onClick={() => run(() => deleteSkill(s.id))} className="rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600" aria-label={t("profile.deleteAria")}><Trash2 className="h-4 w-4" /></button>
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
