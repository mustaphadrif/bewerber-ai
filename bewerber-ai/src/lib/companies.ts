"use server";

import { createClient } from "@/lib/supabase/server";
import type { Company } from "@/lib/db";

/**
 * Company discovery — curated, openly licensed company directory.
 * No scraping: companies are seeded via SQL migration and searchable here.
 * Optional enrichment via a future API key is deliberately not required.
 */

const FALLBACK_COMPANIES: Array<Omit<Company, "id" | "created_at" | "logo_url">> = [
  { name: "SAP SE", industry: "Software", website: "https://www.sap.com", city: "Walldorf", description: "Europas größter Softwarekonzern – ERP- und Cloud-Lösungen." },
  { name: "Siemens AG", industry: "Industrie & Elektronik", website: "https://www.siemens.com", city: "München", description: "Globaler Technologiekonzern für Industrie, Infrastruktur und Gesundheit." },
  { name: "Bosch", industry: "Industrie & Mobilität", website: "https://www.bosch.com", city: "Stuttgart", description: "Technologie- und Dienstleistungsunternehmen, IoT & Mobilität." },
  { name: "Zalando SE", industry: "E-Commerce", website: "https://www.zalando.de", city: "Berlin", description: "Europas führende Online-Plattform für Mode & Lifestyle." },
  { name: "Delivery Hero SE", industry: "E-Commerce", website: "https://www.deliveryhero.com", city: "Berlin", description: "Globale Plattform für lokale Essenslieferung." },
  { name: "N26", industry: "FinTech", website: "https://n26.com", city: "Berlin", description: "Digitale Bank – Mobile Banking für Europa." },
  { name: "Celonis", industry: "Software / Process Mining", website: "https://www.celonis.com", city: "München", description: "Process-Mining-Weltmarktführer aus München." },
  { name: "Personio", industry: "HR-Software", website: "https://www.personio.de", city: "München", description: "HR-Software für kleine und mittelständische Unternehmen." },
  { name: "Flix SE", industry: "Mobilität", website: "https://www.flixbus.de", city: "München", description: "Fernbus- und Bahnangebote in ganz Europa." },
  { name: "Auto1 Group", industry: "Automobil / E-Commerce", website: "https://www.auto1-group.com", city: "Berlin", description: "Europas führende Online-Plattform für Gebrauchtwagen." },
  { name: "Volkswagen AG", industry: "Automobil", website: "https://www.volkswagen.com", city: "Wolfsburg", description: "Einer der größten Automobilhersteller der Welt." },
  { name: "Allianz SE", industry: "Versicherung & Finanzen", website: "https://www.allianz.com", city: "München", description: "Globaler Versicherungs- und Asset-Management-Konzern." },
  { name: "adidas AG", industry: "Konsumgüter / Sport", website: "https://www.adidas.de", city: "Herzogenaurach", description: "Weltweit führender Sportartikelhersteller." },
  { name: "BASF SE", industry: "Chemie", website: "https://www.basf.com", city: "Ludwigshafen", description: "Größter Chemiekonzern der Welt." },
  { name: "Deutsche Telekom", industry: "Telekommunikation", website: "https://www.telekom.com", city: "Bonn", description: "Führender europäischer Telekommunikationsanbieter." },
  { name: "Lufthansa Group", industry: "Luftfahrt", website: "https://www.lufthansa-group.com", city: "Köln", description: "Größte Airline-Gruppe Europas." },
];

export async function listCompanies(filter?: { search?: string; industry?: string }): Promise<Company[]> {
  const supabase = await createClient();
  if (!supabase) {
    // No-env mode: show the curated seed directory so the UI stays functional.
    return seedCompanies(filter);
  }

  let query = supabase.from("companies").select("*").order("name");
  if (filter?.search) query = query.ilike("name", `%${filter.search}%`);
  if (filter?.industry) query = query.eq("industry", filter.industry);

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    // Seeded but empty (e.g. no-env or fresh DB) -> return curated fallback for the UI.
    return seedCompanies(filter);
  }
  return data as Company[];
}

export async function getIndustries(): Promise<string[]> {
  const supabase = await createClient();
  if (!supabase) {
    return [...new Set(FALLBACK_COMPANIES.map((c) => c.industry ?? "").filter(Boolean))];
  }
  const { data, error } = await supabase.from("companies").select("industry").not("industry", "is", null);
  if (error) return [];
  const industries = [...new Set((data as { industry: string }[]).map((r) => r.industry))].sort();
  return industries.length > 0 ? industries : [...new Set(FALLBACK_COMPANIES.map((c) => c.industry ?? "").filter(Boolean))];
}

function seedCompanies(filter?: { search?: string; industry?: string }): Company[] {
  let rows = FALLBACK_COMPANIES.map((c, i) => ({
    ...c,
    logo_url: null,
    id: `seed-${i + 1}`,
    created_at: new Date(0).toISOString(),
  })) as Company[];

  if (filter?.search) {
    const q = filter.search.toLowerCase();
    rows = rows.filter((c) => c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q));
  }
  if (filter?.industry) {
    rows = rows.filter((c) => c.industry === filter.industry);
  }
  return rows;
}
