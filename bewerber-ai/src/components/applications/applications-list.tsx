"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/applications/status-badge";
import { APPLICATION_STATUSES } from "@/lib/db";
import type { ApplicationWithCompany } from "@/lib/applications";
import { formatDate } from "@/lib/utils";
import { Plus, Search, Briefcase } from "lucide-react";

export function ApplicationsList({ initial }: { initial: ApplicationWithCompany[] }) {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Bewerbungen</h1>
          <p className="mt-1 text-muted-foreground">
            {initial.length} gesamt · {initial.filter((a) => !["abgelehnt", "archiviert"].includes(a.status)).length} aktiv
          </p>
        </div>
        <Link href="/bewerbungen/new">
          <Button>
            <Plus className="h-4 w-4" /> Bewerbung anlegen
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Unternehmen oder Position suchen…" className="pl-10" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-56">
          <option value="alle">Alle Status</option>
          {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Briefcase className="h-8 w-8 text-slate-300" />
            <div>
              <p className="text-sm font-medium text-slate-700">
                {initial.length === 0 ? "Noch keine Bewerbungen" : "Keine Treffer"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {initial.length === 0
                  ? "Lege deine erste Bewerbung an, um den Überblick zu behalten."
                  : "Passe Suche oder Statusfilter an."}
              </p>
            </div>
            {initial.length === 0 && (
              <Link href="/bewerbungen/new">
                <Button size="sm">Erste Bewerbung anlegen</Button>
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
                    {a.next_step_at ? `Nächster Schritt: ${formatDate(a.next_step_at)}` : formatDate(a.applied_at ?? a.created_at)}
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
