import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { getI18n } from "@/lib/i18n/server";
import {
  ArrowRight,
  Check,
  FileText,
  PenLine,
  Briefcase,
  Building2,
  Sparkles,
  ShieldCheck,
  Layers,
} from "lucide-react";

const FEATURES = [
  { icon: FileText, titleKey: "landing.feature1Title", textKey: "landing.feature1Text" },
  { icon: PenLine, titleKey: "landing.feature2Title", textKey: "landing.feature2Text" },
  { icon: Briefcase, titleKey: "landing.feature3Title", textKey: "landing.feature3Text" },
  { icon: Building2, titleKey: "landing.feature4Title", textKey: "landing.feature4Text" },
  { icon: Layers, titleKey: "landing.feature5Title", textKey: "landing.feature5Text" },
  { icon: ShieldCheck, titleKey: "landing.feature6Title", textKey: "landing.feature6Text" },
] as const;

const STEPS = [
  { n: "01", titleKey: "landing.step1Title", textKey: "landing.step1Text" },
  { n: "02", titleKey: "landing.step2Title", textKey: "landing.step2Text" },
  { n: "03", titleKey: "landing.step3Title", textKey: "landing.step3Text" },
  { n: "04", titleKey: "landing.step4Title", textKey: "landing.step4Text" },
] as const;

const MOCK_LINES = [
  "Senior Product Manager · SAP SE",
  "Product Owner · Zalando SE",
  "Projektmanager · Bosch",
];

export default async function LandingPage() {
  const { t } = await getI18n();

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <FileText className="h-4.5 w-4.5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Bewerber</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#funktionen" className="hover:text-slate-900">{t("landing.navFeatures")}</a>
            <a href="#so-funktionierts" className="hover:text-slate-900">{t("landing.navHowItWorks")}</a>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link href="/login">
              <Button variant="ghost" size="sm">{t("common.login")}</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">{t("landing.startFree")}</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="blue" className="mb-6 px-3 py-1 text-xs">
              <Sparkles className="h-3 w-3" /> {t("landing.heroBadge")}
            </Badge>
            <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
              {t("landing.heroTitle1")} <br />
              <span className="bg-gradient-to-r from-primary to-sky-500 bg-clip-text text-transparent">
                {t("landing.heroTitle2")}
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
              {t("landing.heroSubtitle")}
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/signup">
                <Button size="lg" className="px-8">
                  {t("landing.startFree")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Button>
              </Link>
              <a href="#funktionen">
                <Button size="lg" variant="outline" className="px-8">
                  {t("landing.discoverFeatures")}
                </Button>
              </a>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {t("landing.heroNote")}
            </p>
          </div>

          {/* Product mock */}
          <div className="mx-auto mt-16 max-w-4xl">
            <div className="rounded-2xl border border-border bg-card p-2 shadow-xl shadow-slate-200/60">
              <div className="rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/40 p-6 sm:p-10">
                <div className="flex flex-col items-start gap-6 sm:flex-row">
                  <div className="w-full flex-1">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                        MM
                      </div>
                      <div>
                        <div className="text-base font-semibold text-slate-900">{t("landing.mockName")}</div>
                        <div className="text-sm text-muted-foreground">{t("landing.mockRole")}</div>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {MOCK_LINES.map((line) => (
                        <div key={line} className="flex items-center gap-3 rounded-lg border border-border/60 bg-white px-4 py-2.5 text-sm shadow-xs">
                          <span className="h-2 w-2 rounded-full bg-primary" />
                          <span className="text-slate-700">{line}</span>
                          <span className="ms-auto rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{t("landing.mockInterview")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="w-full max-w-xs rounded-xl border border-border bg-white p-5 shadow-sm">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("landing.mockProfileCompleteness")}
                    </div>
                    <div className="mb-1.5 flex items-end justify-between">
                      <span className="text-3xl font-semibold text-slate-900">85%</span>
                      <span className="text-xs text-success">{t("landing.mockAlmostDone")}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-[85%] rounded-full bg-primary" />
                    </div>
                    <div className="mt-4 space-y-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span>{t("landing.mockCvReady")}</span><Check className="h-3.5 w-3.5 text-success" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{t("landing.mockLetterCreated")}</span><Check className="h-3.5 w-3.5 text-success" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{t("landing.mockApplicationsActive")}</span><Check className="h-3.5 w-3.5 text-success" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos strip */}
      <section className="border-y border-border/70 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-6 text-sm font-medium text-slate-400">
          <span>{t("landing.logosText")}</span>
          <span className="text-slate-500">SAP</span>
          <span className="text-slate-500">Siemens</span>
          <span className="text-slate-500">Zalando</span>
          <span className="text-slate-500">Bosch</span>
          <span className="text-slate-500">N26</span>
        </div>
      </section>

      {/* Features */}
      <section id="funktionen" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {t("landing.featuresTitle")}
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            {t("landing.featuresSubtitle")}
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.titleKey} className="rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-slate-900">{t(f.titleKey)}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{t(f.textKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="so-funktionierts" className="border-t border-border/70 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {t("landing.stepsTitle")}
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              {t("landing.stepsSubtitle")}
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="relative rounded-xl border border-border bg-card p-6 shadow-sm">
                <span className="text-sm font-semibold text-primary">{s.n}</span>
                <h3 className="mt-3 text-base font-semibold text-slate-900">{t(s.titleKey)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{t(s.textKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-slate-900 px-6 py-16 text-center sm:px-16">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-transparent to-transparent" />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {t("landing.ctaTitle")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
              {t("landing.ctaText")}
            </p>
            <Link href="/signup" className="mt-8 inline-block">
              <Button size="lg" className="bg-white px-10 text-slate-900 hover:bg-slate-100">
                {t("landing.startFree")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/70 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <FileText className="h-3.5 w-3.5" />
            </span>
            <span className="font-medium text-slate-700">Bewerber</span>
          </div>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-slate-900">{t("common.login")}</Link>
            <Link href="/signup" className="hover:text-slate-900">{t("landing.footerRegister")}</Link>
            <a href="#funktionen" className="hover:text-slate-900">{t("landing.navFeatures")}</a>
          </div>
          <span>© {new Date().getFullYear()} Bewerber</span>
        </div>
      </footer>
    </div>
  );
}
