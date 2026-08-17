"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { createApplication } from "@/lib/applications";
import { APPLICATION_STATUSES } from "@/lib/db";
import { useI18n } from "@/lib/i18n/client";
import type { Company } from "@/lib/db";
import { ArrowLeft } from "lucide-react";

export function ApplicationForm({ companies }: { companies: Company[] }) {
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const prefillCompany = searchParams.get("company") ?? "";

  const [form, setForm] = useState({
    company_id: "",
    company_name: prefillCompany,
    job_title: "",
    status: "interessiert",
    location: "",
    salary_range: "",
    job_url: "",
    notes: "",
    applied_at: "",
    next_step_at: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleCompanyPick(value: string) {
    setForm((f) => {
      const company = companies.find((c) => c.id === value);
      return {
        ...f,
        company_id: value,
        company_name: company ? company.name : f.company_name,
        location: company?.city && !f.location ? company.city : f.location,
      };
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createApplication({
        company_id: form.company_id || null,
        company_name: form.company_name.trim(),
        job_title: form.job_title.trim(),
        status: form.status as Parameters<typeof createApplication>[0]["status"],
        location: form.location || null,
        salary_range: form.salary_range || null,
        job_url: form.job_url || null,
        notes: form.notes || null,
        applied_at: form.applied_at || null,
        next_step_at: form.next_step_at || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(result.id ? `/bewerbungen/${result.id}` : "/bewerbungen");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/bewerbungen" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-slate-900">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t("applications.back")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("applications.newTitle")}</h1>
        <p className="mt-1 text-muted-foreground">{t("applications.newSubtitle")}</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>{t("applications.details")}</CardTitle>
          <CardDescription>{t("applications.detailsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="a-company-pick">{t("applications.pickFromDir")}</Label>
                <Select id="a-company-pick" value={form.company_id} onChange={(e) => handleCompanyPick(e.target.value)}>
                  <option value="">{t("applications.ownCompany")}</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="a-company">{t("applications.company")}</Label>
                <Input id="a-company" value={form.company_name} onChange={set("company_name")} placeholder={t("applications.companyPh")} required />
              </div>
              <div>
                <Label htmlFor="a-title">{t("applications.position")}</Label>
                <Input id="a-title" value={form.job_title} onChange={set("job_title")} placeholder={t("applications.positionPh")} required />
              </div>
              <div>
                <Label htmlFor="a-status">{t("applications.status")}</Label>
                <Select id="a-status" value={form.status} onChange={set("status")}>
                  {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{t(`applications.statuses.${s}`)}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="a-location">{t("applications.location")}</Label>
                <Input id="a-location" value={form.location} onChange={set("location")} placeholder={t("applications.locationPh")} />
              </div>
              <div>
                <Label htmlFor="a-salary">{t("applications.salary")}</Label>
                <Input id="a-salary" value={form.salary_range} onChange={set("salary_range")} placeholder={t("applications.salaryPh")} />
              </div>
              <div>
                <Label htmlFor="a-url">{t("applications.url")}</Label>
                <Input id="a-url" type="url" value={form.job_url} onChange={set("job_url")} placeholder={t("applications.urlPh")} />
              </div>
              <div>
                <Label htmlFor="a-applied">{t("applications.appliedAt")}</Label>
                <Input id="a-applied" type="date" value={form.applied_at} onChange={set("applied_at")} />
              </div>
              <div>
                <Label htmlFor="a-next">{t("applications.nextStepAt")}</Label>
                <Input id="a-next" type="date" value={form.next_step_at} onChange={set("next_step_at")} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="a-notes">{t("applications.notes")}</Label>
                <Textarea id="a-notes" rows={3} value={form.notes} onChange={set("notes")} placeholder={t("applications.notesPh")} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Link href="/bewerbungen">
                <Button type="button" variant="ghost">{t("common.cancel")}</Button>
              </Link>
              <Button type="submit" loading={pending} disabled={!form.company_name.trim() || !form.job_title.trim()}>
                {t("applications.newApplication")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
