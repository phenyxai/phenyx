-- ============================================================================
-- PHE-129: polaris plan cards (Oct 20 demo).
--
-- When a polaris reply carries numbered steps, the conversation shows it as a
-- plan card with steps to check off and a save. polaris_messages is
-- append-only, so a plan's state lives here, one row per reply:
--   done      the checked step indexes
--   saved_at  set by "save"; saved plans list under "your conversations"
-- The steps themselves stay in the encrypted reply; nothing is copied out.
--
-- Owner-only SELECT; the service role writes and bypasses RLS.
-- See down: supabase/migrations/down/20261021140000_phe129_polaris_plans_down.sql
-- ============================================================================

create table if not exists public.polaris_plans (
  message_id  uuid primary key references public.polaris_messages(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  done        smallint[] not null default '{}'::smallint[],
  saved_at    timestamptz,
  updated_at  timestamptz not null default now()
);

create index if not exists polaris_plans_user_saved_idx
  on public.polaris_plans (user_id, saved_at desc)
  where saved_at is not null;

alter table public.polaris_plans enable row level security;

drop policy if exists polaris_plans_select_own on public.polaris_plans;
create policy polaris_plans_select_own on public.polaris_plans
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.polaris_plans from public, anon, authenticated;
grant select on table public.polaris_plans to authenticated;
grant all on table public.polaris_plans to service_role;

comment on table public.polaris_plans is
  'PHE-129 plan cards: checked steps and the save for a polaris reply with numbered steps.';
