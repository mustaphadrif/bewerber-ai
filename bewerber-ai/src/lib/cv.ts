import type { Education, Experience, Language, Profile, Skill } from "@/lib/db";
import type { FullProfile } from "@/lib/profile";

/* ── Templates ─────────────────────────────────────────────────────────────── */

export type CvTemplateId = "referenz" | "klar" | "klassisch" | "modern";

export interface CvTemplate {
  id: CvTemplateId;
  label: string;
  description: string;
}

/** The reference template is the main/default template; others remain variants. */
export const CV_TEMPLATES: CvTemplate[] = [
  {
    id: "referenz",
    label: "Referenz",
    description: "Hauptvorlage – kompakter Kopf, Foto oben rechts, schmale Ränder, schwarze Linien.",
  },
  { id: "klar", label: "Klar", description: "Minimalistisch, viel Weißraum, klare Linien." },
  { id: "klassisch", label: "Klassisch", description: "Traditionelles Layout mit zentriertem Kopf." },
  { id: "modern", label: "Modern", description: "Sidebar mit Profil & Fähigkeiten, Akzentfarbe." },
];

export function isCvTemplateId(v: unknown): v is CvTemplateId {
  return CV_TEMPLATES.some((t) => t.id === v);
}

export const ACCENT_COLORS = ["#2563eb", "#0f766e", "#7c3aed", "#b45309", "#be123c", "#334155"] as const;

export interface CvOptions {
  template: CvTemplateId;
  fontSize: number; // 10-14
  accentColor: string;
  includePhoto: boolean;
}

export const DEFAULT_CV_OPTIONS: CvOptions = {
  template: "referenz",
  fontSize: 11,
  accentColor: "#2563eb",
  includePhoto: true,
};

/* ── Structured, editable CV data ─────────────────────────────────────────── */

/** One work/education entry. Dates are free display strings ("2024", "04.2025", "2023 – 2026"). */
export interface CvEntry {
  id: string;
  role: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  /** Newline-separated bullet points. */
  description: string;
}

export interface CvLanguage {
  name: string;
  level: string; // free text: "Muttersprache", "B2 (Fortgeschritten)", "B1 (GOETHE)"
  description: string;
}

export interface CvSection<T> {
  id: string;
  title: string;
  items: T[];
}

export interface CvContact {
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  website: string | null;
}

export interface CvData {
  fullName: string;
  firstName: string;
  lastName: string;
  headline: string;
  /** Display string, e.g. "13.07.2003". */
  birthDate: string;
  contact: CvContact;
  /** "Casablanca, Marokko" – used by the reference template contact row. */
  location: string;
  /** Profile summary (PROFIL section). */
  about: string;
  /** Data URL (inline, size-safe) or public https URL (storage). */
  photoDataUrl: string | null;
  photoName: string;
  skills: { name: string; level: number }[];
  languages: CvLanguage[];
  experience: CvSection<CvEntry>; // BERUFSERFAHRUNG
  internships: CvSection<CvEntry>; // PRAKTIKUM
  education: CvSection<CvEntry>; // SCHULBILDUNG
}

export const CV_SECTIONS = {
  experience: { id: "experience", title: "Berufserfahrung" },
  internships: { id: "internships", title: "Praktikum" },
  education: { id: "education", title: "Schulbildung" },
} as const;

export function newId(prefix = "cv"): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rnd}`;
}

export function fullNameOf(d: Pick<CvData, "firstName" | "lastName">): string {
  return [d.firstName, d.lastName].filter(Boolean).join(" ").trim();
}

/** "2024 – 2025", "04.2025 – 10.2025", "2023 – heute" – uses the raw user strings. */
export function entryPeriod(e: Pick<CvEntry, "startDate" | "endDate" | "current">): string {
  if (!e.startDate && !e.endDate) return "";
  if (e.current && !e.endDate) return e.startDate ? `${e.startDate} – heute` : "heute";
  return [e.startDate, e.endDate].filter(Boolean).join(" – ");
}

/** Keep the historical helper (used by other templates / older saved CVs). */
export function formatRange(start: string | null, end: string | null, current?: boolean): string {
  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("de-DE", { month: "2-digit", year: "numeric" })
      : "";
  if (current) return `${fmt(start)} – heute`;
  return `${fmt(start)} – ${fmt(end)}`;
}

function fmtYear(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : String(d.getFullYear());
}

function fmtBirthDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/* ── Factories ─────────────────────────────────────────────────────────────── */

export function createEmptyCvData(): CvData {
  return {
    fullName: "",
    firstName: "",
    lastName: "",
    headline: "",
    birthDate: "",
    contact: {
      email: null,
      phone: null,
      address: null,
      city: null,
      postalCode: null,
      country: null,
      website: null,
    },
    location: "",
    about: "",
    photoDataUrl: null,
    photoName: "",
    skills: [],
    languages: [],
    experience: { id: CV_SECTIONS.experience.id, title: CV_SECTIONS.experience.title, items: [] },
    internships: { id: CV_SECTIONS.internships.id, title: CV_SECTIONS.internships.title, items: [] },
    education: { id: CV_SECTIONS.education.id, title: CV_SECTIONS.education.title, items: [] },
  };
}

function experienceEntry(row: Experience): CvEntry {
  return {
    id: row.id,
    role: row.position.trim(),
    company: row.company.trim(),
    location: row.location?.trim() ?? "",
    startDate: fmtYear(row.start_date),
    endDate: row.current ? "" : fmtYear(row.end_date),
    current: row.current,
    description: row.description?.trim() ?? "",
  };
}

function educationEntry(row: Education): CvEntry {
  const role = [row.institution.trim(), row.degree?.trim() ? `(${row.degree.trim()})` : null]
    .filter(Boolean)
    .join(" ");
  return {
    id: row.id,
    role,
    company: row.field_of_study?.trim() || row.institution.trim(),
    location: "",
    startDate: fmtYear(row.start_date),
    endDate: fmtYear(row.end_date),
    current: false,
    description: row.description?.trim() ?? "",
  };
}

/**
 * Build the initial editable CV from verified profile data (never invents content).
 * The result is the default value of the CV form; every field stays editable.
 */
export function buildCvData(profile: FullProfile): CvData {
  const p: Profile | null = profile.profile;
  const firstName = p?.first_name?.trim() ?? "";
  const lastName = p?.last_name?.trim() ?? "";
  const cityPart = [p?.city, p?.postal_code].filter(Boolean).join(", ");
  const location = [cityPart, p?.country].filter(Boolean).join(", ");

  return {
    fullName: [firstName, lastName].filter(Boolean).join(" ") || "Vollständiger Name",
    firstName,
    lastName,
    headline: p?.headline?.trim() || p?.job_title?.trim() || "",
    birthDate: fmtBirthDate(p?.birth_date ?? null),
    contact: {
      email: p?.email ?? null,
      phone: p?.phone ?? null,
      address: p?.address ?? null,
      city: cityPart || null,
      postalCode: null,
      country: null,
      website: null,
    },
    location,
    about: p?.about ?? "",
    photoDataUrl: p?.photo_url ?? null,
    photoName: "",
    skills: profile.skills.map((s: Skill) => ({ name: s.name, level: s.level })),
    languages: profile.languages.map((l: Language) => ({ name: l.name, level: l.level, description: "" })),
    experience: { id: CV_SECTIONS.experience.id, title: CV_SECTIONS.experience.title, items: profile.experience.map(experienceEntry) },
    internships: { id: CV_SECTIONS.internships.id, title: CV_SECTIONS.internships.title, items: [] },
    education: { id: CV_SECTIONS.education.id, title: CV_SECTIONS.education.title, items: profile.education.map(educationEntry) },
  };
}

/* ── Saved-document compatibility ──────────────────────────────────────────── */

function isJsonObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function isEntry(v: unknown): v is CvEntry {
  return isJsonObject(v) && typeof v.role === "string" && typeof v.company === "string";
}

function mapEntry(v: unknown): CvEntry {
  if (isEntry(v)) {
    return {
      id: str(v.id) || newId("cv"),
      role: str(v.role),
      company: str(v.company),
      location: str(v.location),
      startDate: str(v.startDate),
      endDate: str(v.endDate),
      current: v.current === true,
      description: str(v.description),
    };
  }
  const o = isJsonObject(v) ? v : {};
  // Legacy: db `experience` row
  if (typeof o.position === "string") {
    return {
      id: str(o.id) || newId("cv"),
      role: str(o.position),
      company: str(o.company),
      location: str(o.location),
      startDate: fmtYear(strOrNull(o.start_date)),
      endDate: o.current === true ? "" : fmtYear(strOrNull(o.end_date)),
      current: o.current === true,
      description: str(o.description),
    };
  }
  // Legacy: db `education` row
  if (typeof o.institution === "string") {
    const institution = str(o.institution);
    const degree = str(o.degree);
    return {
      id: str(o.id) || newId("cv"),
      role: [institution, degree ? `(${degree})` : null].filter(Boolean).join(" "),
      company: str(o.field_of_study) || institution,
      location: "",
      startDate: fmtYear(strOrNull(o.start_date)),
      endDate: fmtYear(strOrNull(o.end_date)),
      current: false,
      description: str(o.description),
    };
  }
  return { id: newId("cv"), role: "", company: "", location: "", startDate: "", endDate: "", current: false, description: "" };
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

function mapSection(v: unknown, fallback: { id: string; title: string }): CvSection<CvEntry> {
  const items = Array.isArray(v)
    ? (v as unknown[])
    : isJsonObject(v) && Array.isArray(v.items)
      ? (v.items as unknown[])
      : [];
  return {
    id: isJsonObject(v) ? str(v.id) || fallback.id : fallback.id,
    title: isJsonObject(v) ? str(v.title) || fallback.title : fallback.title,
    items: items.map(mapEntry),
  };
}

/**
 * Convert the JSON `content` of a saved cv_documents row into editable CvData.
 * Handles both the current shape and older snapshots (db row shapes).
 */
export function cvDataFromSaved(content: unknown): CvData {
  const base = createEmptyCvData();
  if (!isJsonObject(content)) return base;

  const fullName = str(content.fullName);
  const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = str(content.firstName) || nameParts[0] || "";
  const lastName = str(content.lastName) || nameParts.slice(1).join(" ") || "";

  const contactRaw = isJsonObject(content.contact) ? content.contact : {};
  const legacyCity = str(contactRaw.city);

  return {
    fullName: [firstName, lastName].filter(Boolean).join(" ") || fullName,
    firstName,
    lastName,
    headline: str(content.headline),
    birthDate: str(content.birthDate),
    contact: {
      email: strOrNull(contactRaw.email),
      phone: strOrNull(contactRaw.phone),
      address: strOrNull(contactRaw.address),
      city: strOrNull(contactRaw.city),
      postalCode: strOrNull(contactRaw.postalCode),
      country: strOrNull(contactRaw.country),
      website: strOrNull(contactRaw.website),
    },
    location: str(content.location) || legacyCity,
    about: str(content.about),
    photoDataUrl: strOrNull(content.photoDataUrl) ?? strOrNull(content.photoUrl),
    photoName: str(content.photoName),
    skills: Array.isArray(content.skills)
      ? (content.skills as unknown[])
          .filter(isJsonObject)
          .map((s) => ({ name: str(s.name), level: typeof s.level === "number" ? s.level : 3 }))
      : [],
    languages: Array.isArray(content.languages)
      ? (content.languages as unknown[])
          .filter(isJsonObject)
          .map((l) => ({
            name: str(l.name),
            level: str(l.level),
            description: str(l.description),
          }))
      : [],
    experience: mapSection(content.experience, CV_SECTIONS.experience),
    internships: mapSection(content.internships, CV_SECTIONS.internships),
    education: mapSection(content.education, CV_SECTIONS.education),
  };
}

/* ── Misc helpers (kept for other parts of the app) ────────────────────────── */

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
