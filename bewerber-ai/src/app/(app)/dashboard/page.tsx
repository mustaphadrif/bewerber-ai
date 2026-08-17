import Link from "next/link";
import type { Metadata } from "next";
import { getFullProfile } from "@/lib/profile";
import { listApplications } from "@/lib/applications";
import { profileCompletion } from "@/lib/cv";
import { getI18n } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/applications/status-badge";
import { ArrowRight, FileText, PenLine, Briefcase, CheckCircle2, Circle } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.dashboard") };
}

export default async function DashboardPage() {
  const { t, formatDate } = await getI18n();
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
    { label: t("dashboard.personalData"), done: Boolean(p?.first_name && p?.last_name), href: "/profile" },
    { label: t("dashboard.contactData"), done: Boolean(p?.email && p?.phone), href: "/profile" },
    { label: t("dashboard.professionalProfile"), done: Boolean(p?.headline && p?.about), href: "/profile" },
    { label: t("dashboard.experience"), done: full.experience.length > 0, href: "/profile" },
    { label: t("dashboard.education"), done: full.education.length > 0, href: "/profile" },
    { label: t("dashboard.skillsLanguages"), done: full.skills.length > 0 && full.languages.length > 0, href: "/profile" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("dashboard.hello")}{p?.first_name ? `, ${p.first_name}` : ""} 👋
        </h1>
        <p className="mt-1 text-muted-foreground">
          {completion < 100
            ? t("dashboard.incomplete")
            : t("dashboard.complete")}
        </p>
      </div>

      {/* Completion banner */}
      {completion < 100 && (
        <Card className="border-primary/20 bg-gradient-to-r from-blue-50/80 to-white">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800">{t("dashboard.completeness")}</span>
                <span className="font-semibold text-primary">{completion}%</span>
              </div>
              <Progress value={completion} className="h-2.5" />
              <p className="mt-3 text-sm text-muted-foreground">
                {completion < 40
                  ? t("dashboard.onboardingHintLow")
                  : t("dashboard.onboardingHintHigh")}
              </p>
            </div>
            <Link href="/onboarding" className="shrink-0">
              <Button>
                {p?.onboarding_step && p.onboarding_step > 1 ? t("dashboard.onboardingContinue") : t("dashboard.onboardingStart")}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Briefcase} label={t("dashboard.activeApplications")} value={activeApplications.length} />
        <MetricCard icon={CheckCircle2} label={t("dashboard.interviews")} value={interviews} accent="bg-amber-50 text-amber-700" />
        <MetricCard icon={CheckCircle2} label={t("dashboard.offers")} value={offers} accent="bg-emerald-50 text-emerald-700" />
        <MetricCard icon={FileText} label={t("dashboard.completeness")} value={`${completion}%`} accent="bg-blue-50 text-primary" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Checklist */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboard.checklistTitle")}</CardTitle>
            <CardDescription>{t("dashboard.checklistSubtitle")}</CardDescription>
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
              <CardTitle>{t("dashboard.recentTitle")}</CardTitle>
              <CardDescription>{t("dashboard.recentSubtitle")}</CardDescription>
            </div>
            <Link href="/bewerbungen">
              <Button variant="outline" size="sm">{t("common.viewAll")}</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10 text-center">
                <Briefcase className="h-8 w-8 text-slate-300" />
                <div>
                  <p className="text-sm font-medium text-slate-700">{t("dashboard.emptyTitle")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("dashboard.emptyText")}
                  </p>
                </div>
                <Link href="/bewerbungen/new">
                  <Button size="sm">{t("dashboard.newApplication")}</Button>
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
        <QuickAction href="/lebenslauf" icon={FileText} title={t("dashboard.quickCvTitle")} text={t("dashboard.quickCvText")} />
        <QuickAction href="/anschreiben" icon={PenLine} title={t("dashboard.quickLetterTitle")} text={t("dashboard.quickLetterText")} />
        <QuickAction href="/unternehmen" icon={Briefcase} title={t("dashboard.quickCompaniesTitle")} text={t("dashboard.quickCompaniesText")} />
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
