-- Email Sender — atomic daily-send reservations (additive migration).
--
-- Replaces the check-then-increment daily limit (racy under concurrent
-- workers) with atomic per-user/day reservations:
--   * reserve_email_daily_slot(...)   — atomically reserves one slot under a
--     per-user/day advisory lock; returns null when the limit is exhausted.
--   * commit_email_daily_reservation(...) — called after a CONFIRMED provider
--     send; marks the reservation committed and increments sent_count (the
--     only place daily sent_count grows = successful sends only).
--   * release_email_daily_reservation(...) — called on any failed send/retry
--     so the slot is not consumed.
-- Reservations carry a lease (30 min): crashed workers' reservations expire
-- and free the slot again (cleanup runs inside reserve, under the lock).
--
-- Functions are SECURITY DEFINER and check auth.uid() = p_user_id OR
-- auth.role() = 'service_role' (service-role worker / cron). Clients only get
-- a read-only owner policy on the table; all writes go through the functions.
-- No demo/real user data is seeded. Additive and re-runnable (IF NOT EXISTS /
-- create or replace / drop policy if exists).

-- ── Reservation table ───────────────────────────────────────────────────────
create table if not exists public.email_daily_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  -- reserved: slot held before the send | committed: confirmed Gmail send |
  -- released: slot freed after failed/retried send
  status text not null default 'reserved'
    check (status in ('reserved', 'committed', 'released')),
  sent_count integer not null default 0 check (sent_count >= 0),
  -- lease: expired reservations (crashed workers) stop counting and are
  -- deleted on the next reserve call.
  lease_until timestamptz not null default now() + interval '30 minutes',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_daily_reservations_user_day_idx
  on public.email_daily_reservations (user_id, day);
create index if not exists email_daily_reservations_lease_idx
  on public.email_daily_reservations (user_id, day, status, lease_until);

create trigger email_daily_reservations_set_updated_at
  before update on public.email_daily_reservations
  for each row execute function public.set_updated_at();

alter table public.email_daily_reservations enable row level security;

-- Read-only for owners; insert/update/delete happen exclusively through the
-- SECURITY DEFINER functions below (a client cannot fabricate slots).
create policy "email_daily_reservations_select_own"
  on public.email_daily_reservations for select using (auth.uid() = user_id);

-- ── Advisory-lock key (stable per user/day) ─────────────────────────────────
create or replace function public.email_daily_reservation_lock(p_user_id uuid, p_day date)
returns bigint
language sql
stable
as $$
  select hashtextextended(p_user_id::text || ':' || extract(epoch from p_day)::text, 0)
$$;

-- ── Reserve ──────────────────────────────────────────────────────────────────
create or replace function public.reserve_email_daily_slot(p_user_id uuid, p_day date, p_limit integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
  v_reservation_id uuid;
begin
  if auth.uid() <> p_user_id and auth.role() <> 'service_role' then
    raise exception 'Nicht autorisiert';
  end if;

  -- Serialize all workers of the same user/day (different users/days run in
  -- parallel). Transaction-level lock: released when this RPC's transaction
  -- ends.
  perform pg_advisory_xact_lock(public.email_daily_reservation_lock(p_user_id, p_day));

  -- Lease cleanup: reservations from crashed workers no longer count.
  delete from public.email_daily_reservations
   where user_id = p_user_id
     and day = p_day
     and status = 'reserved'
     and lease_until < now();

  -- Used slots = active reservations (1 each) + committed sends (sent_count).
  select coalesce(sum(case when status = 'committed' then sent_count else 1 end), 0)
    into v_used
    from public.email_daily_reservations
   where user_id = p_user_id
     and day = p_day
     and status in ('reserved', 'committed');

  if v_used >= p_limit then
    return null; -- daily limit exhausted → no slot
  end if;

  insert into public.email_daily_reservations (user_id, day, status, sent_count, lease_until)
  values (p_user_id, p_day, 'reserved', 0, now() + interval '30 minutes')
  returning id into v_reservation_id;

  return v_reservation_id;
end;
$$;

-- ── Commit (after a confirmed provider send) ─────────────────────────────────
create or replace function public.commit_email_daily_reservation(p_reservation_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
  v_committed integer;
begin
  if auth.uid() <> p_user_id and auth.role() <> 'service_role' then
    raise exception 'Nicht autorisiert';
  end if;

  select day into v_day
    from public.email_daily_reservations
   where id = p_reservation_id and user_id = p_user_id;

  if v_day is null then
    return; -- unknown/already released reservation → idempotent no-op
  end if;

  perform pg_advisory_xact_lock(public.email_daily_reservation_lock(p_user_id, v_day));

  -- Guard on status='reserved': a double commit cannot double-increment.
  update public.email_daily_reservations
     set status = 'committed',
         sent_count = sent_count + 1,
         lease_until = null,
         updated_at = now()
   where id = p_reservation_id
     and user_id = p_user_id
     and status = 'reserved';

  -- Keep the legacy daily counter in sync (sent_count = successful sends only,
  -- which is what the dashboard shows).
  select coalesce(sum(sent_count), 0) into v_committed
    from public.email_daily_reservations
   where user_id = p_user_id and day = v_day and status = 'committed';

  insert into public.email_daily_counters (user_id, day, sent_count)
  values (p_user_id, v_day, v_committed)
  on conflict (user_id, day)
  do update set sent_count = excluded.sent_count, updated_at = now();
end;
$$;

-- ── Release (on any failed send / retry) ─────────────────────────────────────
create or replace function public.release_email_daily_reservation(p_reservation_id uuid, p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.email_daily_reservations
   where id = p_reservation_id
     and user_id = p_user_id
     and status = 'reserved'
     and (auth.uid() = p_user_id or auth.role() = 'service_role');
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────
-- Restricted to authenticated sessions (the worker routes run as the signed-in
-- user or with the service_role key). Not callable by anon.
revoke all on function public.reserve_email_daily_slot(uuid, date, integer) from public;
revoke all on function public.commit_email_daily_reservation(uuid, uuid) from public;
revoke all on function public.release_email_daily_reservation(uuid, uuid) from public;
grant execute on function public.reserve_email_daily_slot(uuid, date, integer) to authenticated, service_role;
grant execute on function public.commit_email_daily_reservation(uuid, uuid) to authenticated, service_role;
grant execute on function public.release_email_daily_reservation(uuid, uuid) to authenticated, service_role;
