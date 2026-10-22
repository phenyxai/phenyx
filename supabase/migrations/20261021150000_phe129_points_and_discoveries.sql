-- ============================================================================
-- PHE-129: polaris points, bought balances and the discovery week
-- (Oct 21 rebuild doc, section 8; company overview, section 17).
--
--   polaris_points      the month's points used, one row per person per month
--                       (month = first of the month, UTC). 30 free, 300 full.
--   discovery_usage     the week's discoveries revealed from the plan, one row
--                       per person per week (week = the monday it opened).
--   purchased_balances  bought points and discoveries. They never expire,
--                       survive plan changes, and are spent only once the
--                       plan's allowance runs out. Kept off user_profiles,
--                       whose owner-update policy would let a person write
--                       their own balance.
--   purchases           one row per paid stripe checkout session, so a
--                       replayed webhook credits once.
--
-- credit_purchase() inserts the purchase and adds it to the balance in one
-- transaction, and returns false when the session was already credited.
--
-- Owner-only SELECT; the service role writes and bypasses RLS.
-- See down: supabase/migrations/down/20261021150000_phe129_points_and_discoveries_down.sql
-- ============================================================================

create table if not exists public.polaris_points (
  user_id     uuid not null references auth.users(id) on delete cascade,
  month       date not null,
  used        integer not null default 0 check (used >= 0),
  updated_at  timestamptz not null default now(),
  primary key (user_id, month)
);

create table if not exists public.discovery_usage (
  user_id     uuid not null references auth.users(id) on delete cascade,
  week        date not null,
  used        integer not null default 0 check (used >= 0),
  updated_at  timestamptz not null default now(),
  primary key (user_id, week)
);

create table if not exists public.purchased_balances (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  points       integer not null default 0 check (points >= 0),
  discoveries  integer not null default 0 check (discoveries >= 0),
  updated_at   timestamptz not null default now()
);

create table if not exists public.purchases (
  stripe_session_id  text primary key,
  user_id            uuid not null references auth.users(id) on delete cascade,
  kind               text not null check (kind in ('points', 'discoveries')),
  amount             integer not null check (amount > 0),
  created_at         timestamptz not null default now()
);

create index if not exists purchases_user_idx on public.purchases (user_id, created_at desc);

alter table public.polaris_points enable row level security;
alter table public.discovery_usage enable row level security;
alter table public.purchased_balances enable row level security;
alter table public.purchases enable row level security;

drop policy if exists polaris_points_select_own on public.polaris_points;
create policy polaris_points_select_own on public.polaris_points
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists discovery_usage_select_own on public.discovery_usage;
create policy discovery_usage_select_own on public.discovery_usage
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists purchased_balances_select_own on public.purchased_balances;
create policy purchased_balances_select_own on public.purchased_balances
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists purchases_select_own on public.purchases;
create policy purchases_select_own on public.purchases
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.polaris_points, public.discovery_usage, public.purchased_balances, public.purchases
  from public, anon, authenticated;
grant select on table public.polaris_points, public.discovery_usage, public.purchased_balances, public.purchases
  to authenticated;
grant all on table public.polaris_points, public.discovery_usage, public.purchased_balances, public.purchases
  to service_role;

create or replace function public.credit_purchase(
  p_session  text,
  p_user     uuid,
  p_kind     text,
  p_amount   integer
) returns boolean
language plpgsql
set search_path = ''
as $$
begin
  insert into public.purchases (stripe_session_id, user_id, kind, amount)
  values (p_session, p_user, p_kind, p_amount)
  on conflict (stripe_session_id) do nothing;
  if not found then
    return false;
  end if;

  insert into public.purchased_balances (user_id, points, discoveries)
  values (
    p_user,
    case when p_kind = 'points' then p_amount else 0 end,
    case when p_kind = 'discoveries' then p_amount else 0 end
  )
  on conflict (user_id) do update set
    points      = public.purchased_balances.points + excluded.points,
    discoveries = public.purchased_balances.discoveries + excluded.discoveries,
    updated_at  = now();
  return true;
end;
$$;

revoke all on function public.credit_purchase(text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.credit_purchase(text, uuid, text, integer) to service_role;

comment on table public.polaris_points is 'PHE-129: polaris points used per person per month (first of the month, UTC).';
comment on table public.discovery_usage is 'PHE-129: discoveries revealed from the plan per person per week (the monday it opened).';
comment on table public.purchased_balances is 'PHE-129: bought polaris points and discoveries; never expire, spent after the plan allowance.';
comment on table public.purchases is 'PHE-129: one row per paid stripe checkout session; makes webhook crediting idempotent.';
