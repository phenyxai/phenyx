-- ============================================================================
-- PHE-102: new signal.
--
-- One row per pattern a data refresh found that wasn't there before. Attached
-- to one point, with the points involved, a summary, ideas for action, the
-- moments (observations) behind it and their dated sources. `seen_at` is
-- stamped once the reader opens the banner; only unseen rows are served.
-- Observations stay append-only, so seen state lives here, not on is_new.
--
-- Engine-written through the service role; owners can only read their own.
-- Idempotent + re-runnable.
-- See down: supabase/migrations/down/20261010000000_phe102_new_signals_down.sql
-- ============================================================================

create table if not exists public.new_signals (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  pillar           pillar_enum not null,
  points           pillar_enum[] not null default '{}',
  summary          text not null,
  ideas            text[] not null default '{}',
  observation_ids  uuid[] not null default '{}',
  -- [{ observation_id, platform, span }]
  sources          jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now(),
  seen_at          timestamptz
);

-- The served read: a user's newest unseen signal.
create index if not exists new_signals_unseen_idx
  on public.new_signals (user_id, created_at desc)
  where seen_at is null;

alter table public.new_signals enable row level security;

drop policy if exists new_signals_select_own on public.new_signals;
create policy new_signals_select_own on public.new_signals
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.new_signals from public, anon, authenticated;
grant select on table public.new_signals to authenticated;
grant all on table public.new_signals to service_role;

comment on table public.new_signals is
  'PHE-102 a pattern a data refresh found that was not there before. Served while seen_at is null.';
