-- Email Sender — delivery layer (additive migration).
-- Creates only Email Sender tables/columns. Does not alter any non-Email
-- Sender table, trigger, policy, or seed data. Re-runnable (IF NOT EXISTS).
--
-- Privacy notes:
--  * Attachment bytes live ONLY server-side (email_attachments.content_b64,
--    base64). The client UI stores only metadata (id/name/size/type); bytes
--    never reach the browser and never touch localStorage.
--  * Gmail OAuth tokens remain AES-GCM ciphertext in gmail_connections.
--  * No demo/real user data is seeded here.

-- ── Server-side attachment storage ─────────────────────────────────────────
create table if not exists public.email_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.email_campaigns(id) on delete cascade,
  name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes >= 0),
  -- base64 of the file bytes. Server-side only; never requested by client code.
  content_b64 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_attachments_user_idx on public.email_attachments (user_id);
create index if not exists email_attachments_campaign_idx on public.email_attachments (campaign_id);
create index if not exists email_attachments_orphans_idx on public.email_attachments (user_id, campaign_id, created_at);

create trigger email_attachments_set_updated_at
  before update on public.email_attachments
  for each row execute function public.set_updated_at();

-- ── Per-user daily delivery counters ───────────────────────────────────────
-- Incremented atomically after each confirmed successful send (all campaigns).
-- The calendar-day limit is enforced by server code immediately before every
-- send; the limit value comes from user_email_entitlements.recipient_limit
-- (100 default, 400 only after server-side env activation-code validation).
create table if not exists public.email_daily_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  sent_count integer not null default 0 check (sent_count >= 0),
  updated_at timestamptz not null default now(),
  constraint email_daily_counters_user_day_key unique (user_id, day)
);

create index if not exists email_daily_counters_user_idx on public.email_daily_counters (user_id, day desc);

-- Atomic per-user daily counter increment (used by the delivery worker).
-- Runs as the invoking user (security invoker) so RLS still applies: a user
-- can only ever increment their own counter.
create or replace function public.increment_email_daily_counter(p_user_id uuid, p_day date)
returns integer
language sql
security invoker
as $$
  insert into public.email_daily_counters (user_id, day, sent_count)
  values (p_user_id, p_day, 1)
  on conflict (user_id, day)
  do update set sent_count = public.email_daily_counters.sent_count + 1, updated_at = now()
  returning sent_count;
$$;

-- ── Recipient delivery bookkeeping (retry/backoff) ─────────────────────────
alter table public.email_recipients add column if not exists attempts integer not null default 0;
alter table public.email_recipients add column if not exists next_attempt_at timestamptz;

create index if not exists email_recipients_campaign_status_next_idx
  on public.email_recipients (campaign_id, status, next_attempt_at);

-- ── Reply deduplication (real server-synced replies) ───────────────────────
alter table public.email_replies add column if not exists gmail_message_id text;
create unique index if not exists email_replies_user_message_idx
  on public.email_replies (user_id, gmail_message_id);

-- ── Row Level Security ─────────────────────────────────────────────────────
alter table public.email_attachments enable row level security;
alter table public.email_daily_counters enable row level security;

-- Owner-scoped: users may only touch their own rows. content_b64 is intended
-- for the server worker; the client UI never selects it.
create policy "email_attachments_select_own" on public.email_attachments for select using (auth.uid() = user_id);
create policy "email_attachments_insert_own" on public.email_attachments for insert with check (auth.uid() = user_id);
create policy "email_attachments_update_own" on public.email_attachments for update using (auth.uid() = user_id);
create policy "email_attachments_delete_own" on public.email_attachments for delete using (auth.uid() = user_id);

create policy "email_daily_counters_select_own" on public.email_daily_counters for select using (auth.uid() = user_id);
create policy "email_daily_counters_insert_own" on public.email_daily_counters for insert with check (auth.uid() = user_id);
create policy "email_daily_counters_update_own" on public.email_daily_counters for update using (auth.uid() = user_id);
create policy "email_daily_counters_delete_own" on public.email_daily_counters for delete using (auth.uid() = user_id);
