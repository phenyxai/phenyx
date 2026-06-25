-- PHE-5: Row Level Security policies.
-- Idempotency: every CREATE POLICY is preceded by DROP POLICY IF EXISTS.
-- All policies use auth.uid() (Supabase Auth). Service role bypasses RLS entirely.
-- See down migration: supabase/migrations/down/20260603120300_phe5_rls_policies_down.sql

alter table public.user_profiles        enable row level security;
alter table public.user_persona         enable row level security;
alter table public.constellation_points enable row level security;
alter table public.constellation_state  enable row level security;
alter table public.waitlist             enable row level security;

-- ============================================================================
-- user_profiles: owner can SELECT / INSERT / UPDATE own row. No DELETE policy.
-- ============================================================================
drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own on public.user_profiles
  for select using (auth.uid() = user_id);

drop policy if exists user_profiles_insert_own on public.user_profiles;
create policy user_profiles_insert_own on public.user_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists user_profiles_update_own on public.user_profiles;
create policy user_profiles_update_own on public.user_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- user_persona: owner SELECT / INSERT / UPDATE. No DELETE policy.
-- ============================================================================
drop policy if exists user_persona_select_own on public.user_persona;
create policy user_persona_select_own on public.user_persona
  for select using (auth.uid() = user_id);

drop policy if exists user_persona_insert_own on public.user_persona;
create policy user_persona_insert_own on public.user_persona
  for insert with check (auth.uid() = user_id);

drop policy if exists user_persona_update_own on public.user_persona;
create policy user_persona_update_own on public.user_persona
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- constellation_state: owner SELECT / INSERT / UPDATE. No DELETE policy.
-- ============================================================================
drop policy if exists constellation_state_select_own on public.constellation_state;
create policy constellation_state_select_own on public.constellation_state
  for select using (auth.uid() = user_id);

drop policy if exists constellation_state_insert_own on public.constellation_state;
create policy constellation_state_insert_own on public.constellation_state
  for insert with check (auth.uid() = user_id);

drop policy if exists constellation_state_update_own on public.constellation_state;
create policy constellation_state_update_own on public.constellation_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- constellation_points: owner SELECT + INSERT only. No UPDATE/DELETE policies
-- (denied by RLS absence + trigger enforces append-only).
-- ============================================================================
drop policy if exists constellation_points_select_own on public.constellation_points;
create policy constellation_points_select_own on public.constellation_points
  for select using (auth.uid() = user_id);

drop policy if exists constellation_points_insert_own on public.constellation_points;
create policy constellation_points_insert_own on public.constellation_points
  for insert with check (auth.uid() = user_id);

-- ============================================================================
-- waitlist: anon + authenticated may INSERT only. SELECT/UPDATE/DELETE blocked
-- for those roles. Service role bypasses RLS and may read/manage.
-- ============================================================================
drop policy if exists waitlist_insert_public on public.waitlist;
create policy waitlist_insert_public on public.waitlist
  for insert to anon, authenticated with check (true);
