"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/applications/status-badge";
import { updateApplication, deleteApplication, addApplicationNote } from "@/lib/applications";
import { APPLICATION_STATUSES } from "@/lib/db";
import type { ApplicationEvent, ApplicationStatus } from "@/lib/db";
import type { ApplicationWithCompany } from "@/lib/applications";
import { formatDate, formatDateTime } from "@/lib/utils";
import { ArrowLeft, Building2, CalendarDays, ExternalLink, MapPin, Trash2, Wallet, MessageSquarePlus } from "lucide-react";

export function ApplicationDetail({
  application,
  events,
}: {
  application: ApplicationWithCompany;
  events: ApplicationEvent[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ApplicationStatus>(application.status);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Fehler");
        return;
      }
      if (success) setNotice(success);
      router.refresh();
    });
  }

  function changeStatus(next: ApplicationStatus) {
    if (next === status) return;
    setStatus(next);
    run(() => updateApplication(application.id, { status: next }), `Status geändert zu „${next}“.`);
  }

  function handleNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    run(() => addApplicationNote(application.id, note.trim()), "Notiz hinzugefügt.");
    setNote("");
  }

  function handleDelete() {
    if (!window.confirm("Bewerbung wirklich löschen? Alle Einträge der Timeline werden ebenfalls entfernt.")) return;
    run(async () => {
      const result = await deleteApplication(application.id);
      if (result.ok) router.push("/bewerbungen");
      return result;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/bewerbungen" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Zurück zu Bewerbungen
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{application.job_title}</h1>
            <p className="mt-1 flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" /> {application.company_name}
              <StatusBadge status={application.status} />
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={status}
              onChange={(e) => changeStatus(e.target.value as ApplicationStatus)}
              className="w-44"
              aria-label="Status ändern"
            >
              {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Button variant="destructive" size="icon" onClick={handleDelete} loading={pending} aria-label="Löschen">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>Informationen zur Bewerbung</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow icon={MapPin} label="Standort" value={application.location} />
              <InfoRow icon={Wallet} label="Gehalt" value={application.salary_range} />
              <InfoRow icon={CalendarDays} label="Beworben am" value={formatDate(application.applied_at ?? application.created_at)} />
              <InfoRow icon={CalendarDays} label="Nächster Schritt" value={formatDate(application.next_step_at)} />
              {application.job_url && (
                <a href={application.job_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                  <ExternalLink className="h-4 w-4" /> Zur Stellenanzeige
                </a>
              )}
              {application.notes && (
                <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notizen</div>
                  <p className="whitespace-pre-wrap text-slate-700">{application.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notiz hinzufügen</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleNote} className="space-y-3">
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Rückmeldung vom Gespräch…" />
                <Button type="submit" size="sm" disabled={!note.trim()} loading={pending}>
                  <MessageSquarePlus className="h-4 w-4" /> Hinzufügen
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>{events.length} Einträge</CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Noch keine Timeline-Einträge. Statusänderungen und Notizen erscheinen hier.
              </p>
            ) : (
              <ol className="relative space-y-5 border-l border-border pl-5">
                {[...events].reverse().map((ev) => (
                  <li key={ev.id} className="relative">
                    <span className="absolute -left-[26.5px] top-1 h-3 w-3 rounded-full border-2 border-card bg-primary ring-1 ring-primary/30" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">
                        {ev.status_to && ev.status_from
                          ? `„${ev.status_from}“ → „${ev.status_to}“`
                          : ev.status_to
                            ? `Status: „${ev.status_to}“`
                            : "Notiz"}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(ev.created_at)}</span>
                    </div>
                    {ev.note && <p className="mt-1 text-sm text-slate-600">{ev.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <div className="text-slate-800">{value || "–"}</div>
      </div>
    </div>
  );
}
