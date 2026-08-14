-- Email Sender — additive migration.
-- Creates only Email Sender tables (owner-scoped RLS). Does not alter any
-- existing table, trigger, policy, or seed data.
--
-- Privacy notes:
--  * Gmail OAuth tokens are stored ONLY as AES-GCM ciphertext
--    (gmail_connections.encrypted_tokens). No plaintext tokens ever leave the
--    server. The column is never selected by client-facing queries.
--  * No demo/real user data is seeded here.

-- ── Email campaigns ──────────────────────────────────────────────────────────
create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Neue Kampagne',
  subject text not null default '',
  body_html text not null default '',
  body_text text not null default '',
  -- draft | pending | sending | paused | stopped | sent | failed
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'sending', 'paused', 'stopped', 'sent', 'failed')),
  -- queued | running | paused | stopped | done
  queue_state text not null default 'idle'
    check (queue_state in ('idle', 'queued', 'running', 'paused', 'stopped', 'done')),
  total_recipients integer not null default 0 check (total_recipients >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  -- attachment metadata only (name/type/size). File bytes never stored.
  attachments jsonb not null default '[]'::jsonb,
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_campaigns_user_id_idx on public.email_campaigns (user_id);
create index if not exists email_campaigns_user_status_idx on public.email_campaigns (user_id, status);
create index if not exists email_campaigns_updated_idx on public.email_campaigns (user_id, updated_at desc);

create trigger email_campaigns_set_updated_at
  before update on public.email_campaigns
  for each row execute function public.set_updated_at();

-- ── Email recipients ─────────────────────────────────────────────────────────
create table if not exists public.email_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  company text,
  contact_name text,
  -- pending | sending | sent | failed
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed')),
  failure_reason text,
  rate_limited boolean not null default false,
  sent_at timestamptz,
  gmail_message_id text,
  gmail_thread_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_recipients_campaign_idx on public.email_recipients (campaign_id);
create index if not exists email_recipients_user_idx on public.email_recipients (user_id);
create index if not exists email_recipients_campaign_status_idx on public.email_recipients (campaign_id, status);

create trigger email_recipients_set_updated_at
  before update on public.email_recipients
  for each row execute function public.set_updated_at();

-- ── Email events (audit/timeline) ────────────────────────────────────────────
create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references public.email_recipients(id) on delete set null,
  -- created | updated | queued | started | paused | resumed | stopped |
  -- recipient_sent | recipient_failed | retried | completed
  event_type text not null
    check (event_type in (
      'created', 'updated', 'queued', 'started', 'paused', 'resumed',
      'stopped', 'recipient_sent', 'recipient_failed', 'retried', 'completed'
    )),
  message text,
  created_at timestamptz not null default now()
);

create index if not exists email_events_campaign_idx on public.email_events (campaign_id, created_at asc);
create index if not exists email_events_user_idx on public.email_events (user_id);

-- ── Gmail connections (token ciphertext lives here, server-side only) ───────
create table if not exists public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  provider_account_id text,
  scope text,
  encrypted_tokens text not null,
  token_expires_at timestamptz,
  rate_limit_remaining integer,
  rate_limit_reset_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gmail_connections_user_id_idx on public.gmail_connections (user_id);

create trigger gmail_connections_set_updated_at
  before update on public.gmail_connections
  for each row execute function public.set_updated_at();

-- ── User email entitlements ──────────────────────────────────────────────────
-- Default limit 100. The premium limit (400) is only ever applied by server
-- code after validating the activation code against a server-side env var.
create table if not exists public.user_email_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  recipient_limit integer not null default 100 check (recipient_limit between 1 and 400),
  status text not null default 'standard'
    check (status in ('standard', 'premium')),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_email_entitlements_user_id_idx on public.user_email_entitlements (user_id);

create trigger user_email_entitlements_set_updated_at
  before update on public.user_email_entitlements
  for each row execute function public.set_updated_at();

-- ── Email replies (app-associated records only; no live Gmail polling) ───────
create table if not exists public.email_replies (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.email_campaigns(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id text,
  from_email text,
  subject text,
  body_text text,
  received_at timestamptz,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists email_replies_user_idx on public.email_replies (user_id);
create index if not exists email_replies_campaign_idx on public.email_replies (campaign_id);

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.email_campaigns enable row level security;
alter table public.email_recipients enable row level security;
alter table public.email_events enable row level security;
alter table public.gmail_connections enable row level security;
alter table public.user_email_entitlements enable row level security;
alter table public.email_replies enable row level security;

-- Owner-scoped policies: users may only touch their own rows.
create policy "email_campaigns_select_own" on public.email_campaigns for select using (auth.uid() = user_id);
create policy "email_campaigns_insert_own" on public.email_campaigns for insert with check (auth.uid() = user_id);
create policy "email_campaigns_update_own" on public.email_campaigns for update using (auth.uid() = user_id);
create policy "email_campaigns_delete_own" on public.email_campaigns for delete using (auth.uid() = user_id);

create policy "email_recipients_select_own" on public.email_recipients for select using (auth.uid() = user_id);
create policy "email_recipients_insert_own" on public.email_recipients for insert with check (auth.uid() = user_id);
create policy "email_recipients_update_own" on public.email_recipients for update using (auth.uid() = user_id);
create policy "email_recipients_delete_own" on public.email_recipients for delete using (auth.uid() = user_id);

create policy "email_events_select_own" on public.email_events for select using (auth.uid() = user_id);
create policy "email_events_insert_own" on public.email_events for insert with check (auth.uid() = user_id);
create policy "email_events_delete_own" on public.email_events for delete using (auth.uid() = user_id);

create policy "gmail_connections_select_own" on public.gmail_connections for select using (auth.uid() = user_id);
create policy "gmail_connections_insert_own" on public.gmail_connections for insert with check (auth.uid() = user_id);
create policy "gmail_connections_update_own" on public.gmail_connections for update using (auth.uid() = user_id);
create policy "gmail_connections_delete_own" on public.gmail_connections for delete using (auth.uid() = user_id);

create policy "user_email_entitlements_select_own" on public.user_email_entitlements for select using (auth.uid() = user_id);
create policy "user_email_entitlements_insert_own" on public.user_email_entitlements for insert with check (auth.uid() = user_id);
create policy "user_email_entitlements_update_own" on public.user_email_entitlements for update using (auth.uid() = user_id);
create policy "user_email_entitlements_delete_own" on public.user_email_entitlements for delete using (auth.uid() = user_id);

create policy "email_replies_select_own" on public.email_replies for select using (auth.uid() = user_id);
create policy "email_replies_insert_own" on public.email_replies for insert with check (auth.uid() = user_id);
create policy "email_replies_update_own" on public.email_replies for update using (auth.uid() = user_id);
create policy "email_replies_delete_own" on public.email_replies for delete using (auth.uid() = user_id);
