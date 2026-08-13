import Link from "next/link";
import type { Metadata } from "next";
import { getFullProfile } from "@/lib/profile";
import { listApplications } from "@/lib/applications";
import { profileCompletion } from "@/lib/cv";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/applications/status-badge";
import { formatDate } from "@/lib/utils";
import { ArrowRight, FileText, PenLine, Briefcase, CheckCircle2, Circle } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const full = await getFullProfile();
  const applications = await listApplications();
  const completion = profileCompletion(full);
  const p = full.profile;

  const activeApplications = applications.filter(
    (a) => !["abgelehnt", "archiviert"].includes(a.status)
  );
  const interviews = applications.filter((a) => a.status === "interview").length;
  const offers = applications.filter((a) => a.status === "angebot").length;

  const checklist = [
    { label: "Persönliche Daten", done: Boolean(p?.first_name && p?.last_name), href: "/profile" },
    { label: "Kontaktdaten", done: Boolean(p?.email && p?.phone), href: "/profile" },
    { label: "Berufliches Profil", done: Boolean(p?.headline && p?.about), href: "/profile" },
    { label: "Berufserfahrung", done: full.experience.length > 0, href: "/profile" },
    { label: "Ausbildung", done: full.education.length > 0, href: "/profile" },
    { label: "Fähigkeiten & Sprachen", done: full.skills.length > 0 && full.languages.length > 0, href: "/profile" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Hallo{p?.first_name ? `, ${p.first_name}` : ""} 👋
        </h1>
        <p className="mt-1 text-muted-foreground">
          {completion < 100
            ? "Dein Profil ist noch nicht vollständig – so kommen deine Unterlagen in Form."
            : "Dein Profil ist vollständig. Viel Erfolg bei deinen Bewerbungen!"}
        </p>
      </div>

      {/* Completion banner */}
      {completion < 100 && (
        <Card className="border-primary/20 bg-gradient-to-r from-blue-50/80 to-white">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800">Profil-Vollständigkeit</span>
                <span className="font-semibold text-primary">{completion}%</span>
              </div>
              <Progress value={completion} className="h-2.5" />
              <p className="mt-3 text-sm text-muted-foreground">
                {completion < 40
                  ? "Nimm dir 5 Minuten für das Onboarding – danach sind Lebenslauf und Anschreiben startklar."
                  : "Fast geschafft! Ergänze die fehlenden Punkte für ein starkes Profil."}
              </p>
            </div>
            <Link href="/onboarding" className="shrink-0">
              <Button>
                {p?.onboarding_step && p.onboarding_step > 1 ? "Onboarding fortsetzen" : "Onboarding starten"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Briefcase} label="Aktive Bewerbungen" value={activeApplications.length} />
        <MetricCard icon={CheckCircle2} label="Interviews" value={interviews} accent="bg-amber-50 text-amber-700" />
        <MetricCard icon={CheckCircle2} label="Angebote" value={offers} accent="bg-emerald-50 text-emerald-700" />
        <MetricCard icon={FileText} label="Profil-Vollständigkeit" value={`${completion}%`} accent="bg-blue-50 text-primary" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Checklist */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profil-Checkliste</CardTitle>
            <CardDescription>Alles für deine Unterlagen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {checklist.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted"
              >
                {item.done ? (
                  <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-success" />
                ) : (
                  <Circle className="h-4.5 w-4.5 shrink-0 text-slate-300" />
                )}
                <span className={item.done ? "text-slate-500 line-through decoration-slate-300" : "text-slate-800"}>
                  {item.label}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Recent applications */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Letzte Bewerbungen</CardTitle>
              <CardDescription>Dein aktueller Stand</CardDescription>
            </div>
            <Link href="/bewerbungen">
              <Button variant="outline" size="sm">Alle ansehen</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10 text-center">
                <Briefcase className="h-8 w-8 text-slate-300" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Noch keine Bewerbungen</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Lege deine erste Bewerbung an und behalte den Überblick.
                  </p>
                </div>
                <Link href="/bewerbungen/new">
                  <Button size="sm">Bewerbung anlegen</Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {applications.slice(0, 5).map((a) => (
                  <Link key={a.id} href={`/bewerbungen/${a.id}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">{a.job_title}</div>
                      <div className="truncate text-xs text-muted-foreground">{a.company_name}</div>
                    </div>
                    <div className="hidden text-xs text-muted-foreground sm:block">{formatDate(a.applied_at ?? a.created_at)}</div>
                    <StatusBadge status={a.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <QuickAction href="/lebenslauf" icon={FileText} title="Lebenslauf" text="Vorlage wählen, ansehen und als PDF laden." />
        <QuickAction href="/anschreiben" icon={PenLine} title="Anschreiben" text="Auf Basis deines verifizierten Profils erstellen." />
        <QuickAction href="/unternehmen" icon={Briefcase} title="Unternehmen" text="Passende Arbeitgeber entdecken." />
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  accent = "bg-blue-50 text-primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold text-slate-900">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  text,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <Link href={href} className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="font-medium text-slate-900 group-hover:text-primary">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </Link>
  );
}
