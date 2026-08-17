"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/applications/status-badge";
import { APPLICATION_STATUSES } from "@/lib/db";
import { useI18n } from "@/lib/i18n/client";
import type { ApplicationWithCompany } from "@/lib/applications";
import { Plus, Search, Briefcase } from "lucide-react";

export function ApplicationsList({ initial }: { initial: ApplicationWithCompany[] }) {
  const { t, formatDate } = useI18n();
  const [status, setStatus] = useState<string>("alle");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initial.filter((a) => {
      const matchesStatus = status === "alle" || a.status === status;
      const matchesSearch =
        !q ||
        a.company_name.toLowerCase().includes(q) ||
        a.job_title.toLowerCase().includes(q) ||
        (a.location ?? "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [initial, status, search]);

  const activeCount = initial.filter((a) => !["abgelehnt", "archiviert"].includes(a.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("applications.title")}</h1>
          <p className="mt-1 text-muted-foreground">
            {t("applications.subtitle", { total: initial.length, active: activeCount })}
          </p>
        </div>
        <Link href="/bewerbungen/new">
          <Button>
            <Plus className="h-4 w-4" /> {t("applications.newApplication")}
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("applications.searchPh")} className="ps-10" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-56">
          <option value="alle">{t("applications.allStatuses")}</option>
          {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{t(`applications.statuses.${s}`)}</option>)}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Briefcase className="h-8 w-8 text-slate-300" />
            <div>
              <p className="text-sm font-medium text-slate-700">
                {initial.length === 0 ? t("applications.emptyTitle") : t("applications.noResults")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {initial.length === 0
                  ? t("applications.emptyText")
                  : t("applications.noResultsText")}
              </p>
            </div>
            {initial.length === 0 && (
              <Link href="/bewerbungen/new">
                <Button size="sm">{t("applications.firstApplication")}</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filtered.map((a) => (
                <Link key={a.id} href={`/bewerbungen/${a.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/50">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <Briefcase className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">{a.job_title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {a.company_name}
                      {a.location ? ` · ${a.location}` : ""}
                    </div>
                  </div>
                  <div className="hidden text-xs text-muted-foreground md:block">
                    {a.next_step_at ? t("applications.nextStep", { date: formatDate(a.next_step_at) }) : formatDate(a.applied_at ?? a.created_at)}
                  </div>
                  <StatusBadge status={a.status} />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
