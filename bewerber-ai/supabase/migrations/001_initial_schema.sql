-- Bewerber — initial schema
-- Auth: Supabase Auth (auth.users). Every user-owned table has RLS enabled.

-- ── Trigger: bump updated_at ────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  email text,
  phone text,
  address text,
  city text,
  postal_code text,
  country text,
  birth_date date,
  job_title text,
  headline text,
  about text,
  photo_url text,
  onboarding_completed boolean not null default false,
  onboarding_step integer not null default 1 check (onboarding_step between 0 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_user_id_idx on public.profiles (user_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── Education ───────────────────────────────────────────────────────────────
create table if not exists public.education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institution text not null,
  degree text,
  field_of_study text,
  start_date date,
  end_date date,
  grade text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists education_user_id_idx on public.education (user_id);
create index if not exists education_user_start_idx on public.education (user_id, start_date desc);

create trigger education_set_updated_at
  before update on public.education
  for each row execute function public.set_updated_at();

-- ── Experience ──────────────────────────────────────────────────────────────
create table if not exists public.experience (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  position text not null,
  location text,
  start_date date,
  end_date date,
  current boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists experience_user_id_idx on public.experience (user_id);
create index if not exists experience_user_start_idx on public.experience (user_id, start_date desc);

create trigger experience_set_updated_at
  before update on public.experience
  for each row execute function public.set_updated_at();

-- ── Languages ───────────────────────────────────────────────────────────────
create table if not exists public.languages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  level text not null check (level in ('A1','A2','B1','B2','C1','C2','Muttersprache')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists languages_user_id_idx on public.languages (user_id);

create trigger languages_set_updated_at
  before update on public.languages
  for each row execute function public.set_updated_at();

-- ── Skills ──────────────────────────────────────────────────────────────────
create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  level smallint not null default 3 check (level between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists skills_user_id_idx on public.skills (user_id);

create trigger skills_set_updated_at
  before update on public.skills
  for each row execute function public.set_updated_at();

-- ── CV documents ────────────────────────────────────────────────────────────
create table if not exists public.cv_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Lebenslauf',
  template text not null default 'klar' check (template in ('klar','klassisch','modern')),
  font_size smallint not null default 12 check (font_size between 10 and 14),
  accent_color text not null default '#2563eb',
  include_photo boolean not null default false,
  content jsonb not null default '{}'::jsonb,
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cv_documents_user_id_idx on public.cv_documents (user_id);

create trigger cv_documents_set_updated_at
  before update on public.cv_documents
  for each row execute function public.set_updated_at();

-- ── Cover letters ───────────────────────────────────────────────────────────
create table if not exists public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  job_title text not null,
  recipient_name text,
  content text not null,
  generated_by text not null default 'ki',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cover_letters_user_id_idx on public.cover_letters (user_id);

create trigger cover_letters_set_updated_at
  before update on public.cover_letters
  for each row execute function public.set_updated_at();

-- ── Companies (curated directory, no scraping) ─────────────────────────────
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  industry text,
  website text,
  city text,
  description text,
  logo_url text,
  created_at timestamptz not null default now()
);

create index if not exists companies_name_idx on public.companies (name);
create index if not exists companies_industry_idx on public.companies (industry);

-- ── Applications ────────────────────────────────────────────────────────────
create type public.application_status as enum (
  'interessiert', 'beworben', 'gesehen', 'interview', 'angebot', 'abgelehnt', 'archiviert'
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  company_name text not null,
  job_title text not null,
  status public.application_status not null default 'interessiert',
  location text,
  salary_range text,
  job_url text,
  notes text,
  applied_at date,
  next_step_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applications_user_id_idx on public.applications (user_id);
create index if not exists applications_user_status_idx on public.applications (user_id, status);
create index if not exists applications_company_id_idx on public.applications (company_id);

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

-- ── Application timeline events ─────────────────────────────────────────────
create table if not exists public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status_from public.application_status,
  status_to public.application_status,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists application_events_application_id_idx on public.application_events (application_id, created_at asc);

-- ── Seed companies (curated, openly known employers) ───────────────────────
insert into public.companies (name, industry, website, city, description) values
  ('SAP SE', 'Software', 'https://www.sap.com', 'Walldorf', 'Europas größter Softwarekonzern – ERP- und Cloud-Lösungen.'),
  ('Siemens AG', 'Industrie & Elektronik', 'https://www.siemens.com', 'München', 'Globaler Technologiekonzern für Industrie, Infrastruktur und Gesundheit.'),
  ('Bosch', 'Industrie & Mobilität', 'https://www.bosch.com', 'Stuttgart', 'Technologie- und Dienstleistungsunternehmen, IoT & Mobilität.'),
  ('Zalando SE', 'E-Commerce', 'https://www.zalando.de', 'Berlin', 'Europas führende Online-Plattform für Mode & Lifestyle.'),
  ('Delivery Hero SE', 'E-Commerce', 'https://www.deliveryhero.com', 'Berlin', 'Globale Plattform für lokale Essenslieferung.'),
  ('N26', 'FinTech', 'https://n26.com', 'Berlin', 'Digitale Bank – Mobile Banking für Europa.'),
  ('Celonis', 'Software / Process Mining', 'https://www.celonis.com', 'München', 'Process-Mining-Weltmarktführer aus München.'),
  ('Personio', 'HR-Software', 'https://www.personio.de', 'München', 'HR-Software für kleine und mittelständische Unternehmen.'),
  ('Flix SE', 'Mobilität', 'https://www.flixbus.de', 'München', 'Fernbus- und Bahnangebote in ganz Europa.'),
  ('Volkswagen AG', 'Automobil', 'https://www.volkswagen.com', 'Wolfsburg', 'Einer der größten Automobilhersteller der Welt.'),
  ('Allianz SE', 'Versicherung & Finanzen', 'https://www.allianz.com', 'München', 'Globaler Versicherungs- und Asset-Management-Konzern.'),
  ('adidas AG', 'Konsumgüter / Sport', 'https://www.adidas.de', 'Herzogenaurach', 'Weltweit führender Sportartikelhersteller.'),
  ('BASF SE', 'Chemie', 'https://www.basf.com', 'Ludwigshafen', 'Größter Chemiekonzern der Welt.'),
  ('Deutsche Telekom', 'Telekommunikation', 'https://www.telekom.com', 'Bonn', 'Führender europäischer Telekommunikationsanbieter.')
on conflict (name) do nothing;

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.education enable row level security;
alter table public.experience enable row level security;
alter table public.languages enable row level security;
alter table public.skills enable row level security;
alter table public.cv_documents enable row level security;
alter table public.cover_letters enable row level security;
alter table public.applications enable row level security;
alter table public.application_events enable row level security;
alter table public.companies enable row level security;

-- Own-data policies
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id);

create policy "education_select_own" on public.education for select using (auth.uid() = user_id);
create policy "education_insert_own" on public.education for insert with check (auth.uid() = user_id);
create policy "education_update_own" on public.education for update using (auth.uid() = user_id);
create policy "education_delete_own" on public.education for delete using (auth.uid() = user_id);

create policy "experience_select_own" on public.experience for select using (auth.uid() = user_id);
create policy "experience_insert_own" on public.experience for insert with check (auth.uid() = user_id);
create policy "experience_update_own" on public.experience for update using (auth.uid() = user_id);
create policy "experience_delete_own" on public.experience for delete using (auth.uid() = user_id);

create policy "languages_select_own" on public.languages for select using (auth.uid() = user_id);
create policy "languages_insert_own" on public.languages for insert with check (auth.uid() = user_id);
create policy "languages_update_own" on public.languages for update using (auth.uid() = user_id);
create policy "languages_delete_own" on public.languages for delete using (auth.uid() = user_id);

create policy "skills_select_own" on public.skills for select using (auth.uid() = user_id);
create policy "skills_insert_own" on public.skills for insert with check (auth.uid() = user_id);
create policy "skills_update_own" on public.skills for update using (auth.uid() = user_id);
create policy "skills_delete_own" on public.skills for delete using (auth.uid() = user_id);

create policy "cv_documents_select_own" on public.cv_documents for select using (auth.uid() = user_id);
create policy "cv_documents_insert_own" on public.cv_documents for insert with check (auth.uid() = user_id);
create policy "cv_documents_update_own" on public.cv_documents for update using (auth.uid() = user_id);
create policy "cv_documents_delete_own" on public.cv_documents for delete using (auth.uid() = user_id);

create policy "cover_letters_select_own" on public.cover_letters for select using (auth.uid() = user_id);
create policy "cover_letters_insert_own" on public.cover_letters for insert with check (auth.uid() = user_id);
create policy "cover_letters_update_own" on public.cover_letters for update using (auth.uid() = user_id);
create policy "cover_letters_delete_own" on public.cover_letters for delete using (auth.uid() = user_id);

create policy "applications_select_own" on public.applications for select using (auth.uid() = user_id);
create policy "applications_insert_own" on public.applications for insert with check (auth.uid() = user_id);
create policy "applications_update_own" on public.applications for update using (auth.uid() = user_id);
create policy "applications_delete_own" on public.applications for delete using (auth.uid() = user_id);

create policy "application_events_select_own" on public.application_events for select using (auth.uid() = user_id);
create policy "application_events_insert_own" on public.application_events for insert with check (auth.uid() = user_id);
create policy "application_events_delete_own" on public.application_events for delete using (auth.uid() = user_id);

-- Companies: readable by all authenticated users (directory data), write by service role only.
create policy "companies_select_authenticated" on public.companies for select using (auth.role() = 'authenticated');
