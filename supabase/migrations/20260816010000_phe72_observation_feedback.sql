-- ============================================================================
-- PHE-72: v67 observation feedback loop (`does this land?`).
--
-- One row per user per observation. Verdicts are internal (`new` | `known` |
-- `reading`); `opened` is a passive signal from opening the evidence chain
-- (PHE-71). `change it` deletes the row. Owner-only RLS; service role writes
-- through the observations API and still bypasses RLS.
--
-- Idempotent + re-runnable (CREATE TABLE/INDEX IF NOT EXISTS, guarded
-- policies, CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS).
-- See down: supabase/migrations/down/20260816010000_phe72_observation_feedback_down.sql
-- ============================================================================

create table if not exists public.observation_feedback (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  observation_id  uuid not null references public.observations(id) on delete cascade,
  verdict         text,
  opened          boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint observation_feedback_verdict_check check (
    verdict is null or verdict in ('new', 'known', 'reading')
  )
);

alter table public.observation_feedback add column if not exists user_id uuid not null;
alter table public.observation_feedback add column if not exists observation_id uuid not null;
alter table public.observation_feedback add column if not exists verdict text;
alter table public.observation_feedback add column if not exists opened boolean not null default false;
alter table public.observation_feedback add column if not exists created_at timestamptz not null default now();
alter table public.observation_feedback add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'observation_feedback_verdict_check'
      and conrelid = 'public.observation_feedback'::regclass
  ) then
    alter table public.observation_feedback
      add constraint observation_feedback_verdict_check check (
        verdict is null or verdict in ('new', 'known', 'reading')
      );
  end if;
end $$;

-- Unique (user_id, observation_id) — constraint so PostgREST ON CONFLICT works.
-- Also covers the RLS user_id lookup.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'observation_feedback_user_observation_key'
      and conrelid = 'public.observation_feedback'::regclass
  ) then
    alter table public.observation_feedback
      add constraint observation_feedback_user_observation_key unique (user_id, observation_id);
  end if;
end $$;

-- FK index for observation cascade / joins (unique above is user-leading).
create index if not exists observation_feedback_observation_id_idx
  on public.observation_feedback (observation_id);

-- ============================================================================
-- Owner must match the observation's owner (defense in depth vs a guessed id).
-- ============================================================================
create or replace function public.phe72_feedback_owner_match()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.observations o
    where o.id = new.observation_id
      and o.user_id = new.user_id
  ) then
    raise exception 'observation_feedback owner must match observation owner';
  end if;
  return new;
end;
$$;

drop trigger if exists observation_feedback_owner_match on public.observation_feedback;
create trigger observation_feedback_owner_match
  before insert or update on public.observation_feedback
  for each row execute function public.phe72_feedback_owner_match();

-- ============================================================================
-- Row Level Security — owner-only SELECT/INSERT/UPDATE/DELETE.
-- `(select auth.uid())` so the uid is evaluated once per query, not per row.
-- UPDATE uses both USING and WITH CHECK so user_id cannot be reassigned.
-- ============================================================================
alter table public.observation_feedback enable row level security;

drop policy if exists observation_feedback_select_own on public.observation_feedback;
create policy observation_feedback_select_own on public.observation_feedback
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists observation_feedback_insert_own on public.observation_feedback;
create policy observation_feedback_insert_own on public.observation_feedback
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists observation_feedback_update_own on public.observation_feedback;
create policy observation_feedback_update_own on public.observation_feedback
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists observation_feedback_delete_own on public.observation_feedback;
create policy observation_feedback_delete_own on public.observation_feedback
  for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.observation_feedback from public, anon;
grant select, insert, update, delete on table public.observation_feedback to authenticated;
grant all on table public.observation_feedback to service_role;

comment on table public.observation_feedback is
  'PHE-72 per-observation verdict (new|known|reading) and evidence-opened flag. Never stores the observation body.';
comment on column public.observation_feedback.verdict is
  'Internal only: new (yes), known (yes, already knew), reading (not quite). Null when only opened is set.';
comment on column public.observation_feedback.opened is
  'Passive signal: the evidence chain was opened, even with no button press.';
