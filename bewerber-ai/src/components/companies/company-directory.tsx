"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";
import type { Company } from "@/lib/db";
import { Building2, ExternalLink, Search } from "lucide-react";

/**
 * Company discovery UI. Backed by the curated directory (SQL seed + fallback
 * data in lib/companies.ts). Filtering happens client-side for instant UX;
 * the architecture supports server-side enrichment later (see lib/companies.ts).
 */
export function CompanyDirectory({ companies, industries }: { companies: Company[]; industries: string[] }) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("alle");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q) ||
        (c.city ?? "").toLowerCase().includes(q);
      const matchesIndustry = industry === "alle" || c.industry === industry;
      return matchesSearch && matchesIndustry;
    });
  }, [companies, search, industry]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("companies.title")}</h1>
        <p className="mt-1 text-muted-foreground">
          {t("companies.subtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("companies.searchPh")}
            className="ps-10"
          />
        </div>
        <Select value={industry} onChange={(e) => setIndustry(e.target.value)} className="sm:w-64">
          <option value="alle">{t("companies.allIndustries")}</option>
          {industries.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        {t("companies.found", { count: filtered.length })}
      </p>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Building2 className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-muted-foreground">{t("companies.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="flex flex-col transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  {c.industry && <Badge variant="secondary">{c.industry}</Badge>}
                </div>
                <CardTitle className="mt-3">{c.name}</CardTitle>
                <CardDescription>{[c.city, c.website?.replace(/^https?:\/\//, "")].filter(Boolean).join(" · ")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                {c.description && (
                  <p className="mb-4 flex-1 text-sm leading-relaxed text-slate-600">{c.description}</p>
                )}
                <div className="flex gap-2">
                  {c.website && (
                    <a
                      href={c.website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:bg-muted"
                    >
                      {t("companies.careerPage")} <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <Link href={`/bewerbungen/new?company=${encodeURIComponent(c.name)}`}>
                    <Button size="sm">{t("companies.newApplication")}</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t("companies.footerNote")}
      </p>
    </div>
  );
}
