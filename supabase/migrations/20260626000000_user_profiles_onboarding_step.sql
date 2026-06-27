-- PHE-14: Resumable onboarding foundation.
-- Adds user_profiles.onboarding_step — the persisted single source of truth for
-- the user's position in the post-auth narrative funnel, so a mid-onboarding
-- refresh (or another device) resumes where they left off instead of restarting
-- at welcome/sign-up.
--
-- Convention: mirrors PHE-5 (20260603120000) — a guarded enum type + a defensive
-- ADD COLUMN IF NOT EXISTS so the migration is idempotent and replay-safe.
-- RLS: no new policy needed. The existing owner-only user_profiles policies
-- already gate this row; a plain column add inherits them.
-- See down migration: supabase/migrations/down/20260626000000_user_profiles_onboarding_step_down.sql

-- ============================================================================
-- Enum: onboarding_step (8 funnel positions, prototype go() router order)
--   welcome → fork → manifesto → polaris_intro → connect → synthesizing
--           → reveal → done
-- ============================================================================
do $$ begin
  create type onboarding_step as enum (
    'welcome',
    'fork',
    'manifesto',
    'polaris_intro',
    'connect',
    'synthesizing',
    'reveal',
    'done'
  );
exception when duplicate_object then null; end $$;

-- ============================================================================
-- Column: user_profiles.onboarding_step
-- Defaults to 'welcome' (a freshly created profile is conceptually at the
-- stellar-color welcome). The client treats both NULL and 'welcome' as "land on
-- the s3b fork", so legacy/pre-column rows resume correctly with no backfill.
-- ============================================================================
alter table public.user_profiles
  add column if not exists onboarding_step onboarding_step not null default 'welcome';

comment on column public.user_profiles.onboarding_step is
  'Persisted position in the onboarding funnel (PHE-14). Single source of truth for resume-on-load; set on each forward transition. NULL/welcome => render the s3b fork; done => onboarding complete (route to dashboard).';
