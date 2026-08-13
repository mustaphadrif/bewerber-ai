// TypeScript types mirroring supabase/migrations/0001_init.sql
// These are hand-written so the app type-checks without a generated client.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  birth_date: string | null;
  job_title: string | null;
  headline: string | null;
  about: string | null;
  photo_url: string | null;
  onboarding_completed: boolean;
  onboarding_step: number;
  created_at: string;
  updated_at: string;
}

export interface Education {
  id: string;
  user_id: string;
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  grade: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Experience {
  id: string;
  user_id: string;
  company: string;
  position: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  current: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Language {
  id: string;
  user_id: string;
  name: string;
  level: string; // A1–C2
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: string;
  user_id: string;
  name: string;
  level: number; // 1-5
  created_at: string;
  updated_at: string;
}

export interface CvDocument {
  id: string;
  user_id: string;
  title: string;
  template: string;
  font_size: number;
  accent_color: string;
  include_photo: boolean;
  content: Json; // snapshot of the profile data used for this CV
  file_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoverLetter {
  id: string;
  user_id: string;
  company_name: string;
  job_title: string;
  recipient_name: string | null;
  content: string;
  generated_by: string;
  created_at: string;
  updated_at: string;
}

export type ApplicationStatus =
  | "interessiert"
  | "beworben"
  | "gesehen"
  | "interview"
  | "angebot"
  | "abgelehnt"
  | "archiviert";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "interessiert",
  "beworben",
  "gesehen",
  "interview",
  "angebot",
  "abgelehnt",
  "archiviert",
];

export interface Company {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  city: string | null;
  description: string | null;
  logo_url: string | null;
  created_at: string;
}

export interface Application {
  id: string;
  user_id: string;
  company_id: string | null;
  company_name: string;
  job_title: string;
  status: ApplicationStatus;
  location: string | null;
  salary_range: string | null;
  job_url: string | null;
  notes: string | null;
  applied_at: string | null;
  next_step_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationEvent {
  id: string;
  application_id: string;
  user_id: string;
  status_from: ApplicationStatus | null;
  status_to: ApplicationStatus;
  note: string | null;
  created_at: string;
}
