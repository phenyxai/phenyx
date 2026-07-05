-- ============================================================================
-- PHE-42: Account Lifecycle — user_profiles.frozen flag.
--
-- A frozen account is PAUSED, not deleted: freeze suspends Onairos pulls, the
-- weekly observation cron, and synthesis triggers, while every existing row is
-- retained and still served (the constellation and observations stay readable).
-- Unfreeze restores normal operation. Driven owner-side by POST /account/freeze
-- and POST /account/unfreeze; the backend reads this flag at each trigger seam.
--
-- Idempotent + re-runnable (ADD COLUMN IF NOT EXISTS). Safe to apply on an
-- already-populated DB — the local Supabase volume is shared across worktrees.
--
-- Account DELETE needs no schema change: every per-user table already declares
-- `references auth.users(id) on delete cascade` (phe5 + phe31 + phe39), so a
-- service-role delete of the auth user cascades to all owned rows.
--
-- See down migration: supabase/migrations/down/20260703140000_phe42_user_frozen_down.sql
-- ============================================================================

alter table public.user_profiles
  add column if not exists frozen boolean not null default false;
