import type { Education, Experience, Language, Profile, Skill } from "@/lib/db";
import type { FullProfile } from "@/lib/profile";

export type CvTemplateId = "klar" | "klassisch" | "modern";

export interface CvTemplate {
  id: CvTemplateId;
  label: string;
  description: string;
}

export const CV_TEMPLATES: CvTemplate[] = [
  { id: "klar", label: "Klar", description: "Minimalistisch, viel Weißraum, klare Linien." },
  { id: "klassisch", label: "Klassisch", description: "Traditionelles Layout mit zentriertem Kopf." },
  { id: "modern", label: "Modern", description: "Sidebar mit Profil & Fähigkeiten, Akzentfarbe." },
];

export const ACCENT_COLORS = ["#2563eb", "#0f766e", "#7c3aed", "#b45309", "#be123c", "#334155"] as const;

export interface CvOptions {
  template: CvTemplateId;
  fontSize: number; // 10-14
  accentColor: string;
  includePhoto: boolean;
}

export const DEFAULT_CV_OPTIONS: CvOptions = {
  template: "klar",
  fontSize: 12,
  accentColor: "#2563eb",
  includePhoto: false,
};

export interface CvSection<T> {
  id: string;
  title: string;
  items: T[];
}

export interface CvData {
  fullName: string;
  headline: string;
  contact: {
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
    website: string | null;
  };
  about: string;
  skills: { name: string; level: number }[];
  languages: { name: string; level: string }[];
  experience: CvSection<Experience>;
  education: CvSection<Education>;
}

/** Build the CV strictly from verified profile data (no invented content). */
export function buildCvData(profile: FullProfile): CvData {
  const p: Profile | null = profile.profile;
  const cityPart = [p?.city, p?.postal_code].filter(Boolean).join(", ");
  return {
    fullName: [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Vollständiger Name",
    headline: p?.headline || p?.job_title || "",
    contact: {
      email: p?.email ?? null,
      phone: p?.phone ?? null,
      address: p?.address ?? null,
      city: cityPart || p?.country || null,
      postalCode: null,
      country: null,
      website: null,
    },
    about: p?.about ?? "",
    skills: profile.skills.map((s: Skill) => ({ name: s.name, level: s.level })),
    languages: profile.languages.map((l: Language) => ({ name: l.name, level: l.level })),
    experience: { id: "experience", title: "Berufserfahrung", items: profile.experience },
    education: { id: "education", title: "Ausbildung", items: profile.education },
  };
}

export function formatRange(start: string | null, end: string | null, current?: boolean): string {
  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("de-DE", { month: "2-digit", year: "numeric" })
      : "";
  if (current) return `${fmt(start)} – heute`;
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Estimate profile completion 0-100 from verified fields. */
export function profileCompletion(profile: FullProfile): number {
  let score = 0;
  let total = 0;
  const p = profile.profile;

  const baseChecks: Array<() => boolean> = [
    () => Boolean(p?.first_name && p?.last_name),
    () => Boolean(p?.email),
    () => Boolean(p?.phone),
    () => Boolean(p?.city),
    () => Boolean(p?.headline),
    () => Boolean(p?.about),
  ];
  for (const check of baseChecks) {
    total += 1;
    if (check()) score += 1;
  }

  total += 1;
  if (profile.experience.length > 0) score += 1;
  total += 1;
  if (profile.education.length > 0) score += 1;
  total += 1;
  if (profile.skills.length > 0) score += 1;
  total += 1;
  if (profile.languages.length > 0) score += 1;

  return total === 0 ? 0 : Math.round((score / total) * 100);
}

/** Ordered onboarding steps with labels. */
export const ONBOARDING_STEPS = [
  { id: "person", title: "Persönliche Daten", short: "Daten" },
  { id: "kontakt", title: "Kontakt & Adresse", short: "Kontakt" },
  { id: "beruf", title: "Berufliches Profil", short: "Beruf" },
  { id: "erfahrung", title: "Berufserfahrung", short: "Erfahrung" },
  { id: "bildung", title: "Ausbildung & Sprachen", short: "Bildung" },
  { id: "faehigkeiten", title: "Fähigkeiten & Abschluss", short: "Abschluss" },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];
