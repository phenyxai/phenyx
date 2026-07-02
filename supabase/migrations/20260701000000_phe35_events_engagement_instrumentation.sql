-- PHE-35: Engagement instrumentation — `events` table for the client analytics queue.
-- Purpose: Ensure the append-only analytics `events` table, its indexes, and its
--          owner-only RLS exist for the PHE-35 client queue (navigation +
--          engagement events; NO free-text user content ever in `props`).
-- Idempotency: CREATE TABLE/INDEX IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, and
--              DROP POLICY IF EXISTS before CREATE POLICY. Safe to re-run.
-- See down migration: supabase/migrations/down/20260701000000_phe35_events_engagement_instrumentation_down.sql
--
-- Relationship to PHE-31: the `events` table was first introduced by
-- 20260625120000_phe31_observation_polaris_model.sql (alongside the observation +
-- Polaris model). This migration is written to be self-contained AND additive —
-- it re-asserts the table/RLS idempotently (so PHE-35 applies cleanly even
-- against a DB that predates PHE-31) and adds the composite
-- (event_type, occurred_at desc) index this ticket specifies. It never conflicts
-- with PHE-31 because every statement is guarded.

-- ============================================================================
-- events — append-only analytics engagement events. Structured props only; NO
-- message content ever. `occurred_at` is the client timestamp from the queue.
-- ============================================================================
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_type  text not null,                      -- tab_visit | tab_duration | days_since_last_visit | polaris_message | login | upgrade_to_pro | downgrade_to_free
  props       jsonb not null default '{}'::jsonb,  -- structured, NO message content
  occurred_at timestamptz not null default now(),  -- client timestamp (from queue)
  created_at  timestamptz not null default now()
);

-- Defensive ADD COLUMN IF NOT EXISTS for the case where the table predates this migration.
alter table public.events add column if not exists user_id uuid not null;
alter table public.events add column if not exists event_type text not null;
alter table public.events add column if not exists props jsonb not null default '{}'::jsonb;
alter table public.events add column if not exists occurred_at timestamptz not null default now();
alter table public.events add column if not exists created_at timestamptz not null default now();

-- ============================================================================
-- Indexes — per the ticket: (user_id, occurred_at desc) and
-- (event_type, occurred_at desc). The first shares PHE-31's name so we never
-- create a duplicate; the second is added by this migration.
-- ============================================================================
create index if not exists events_user_time_idx
  on public.events (user_id, occurred_at desc);
create index if not exists events_type_time_idx
  on public.events (event_type, occurred_at desc);

-- ============================================================================
-- Row Level Security — owner-only. A user may INSERT / SELECT only their own
-- rows (auth.uid() = user_id), matching the user_profiles policies. No
-- UPDATE/DELETE policies: the feed is append-only (PHE-31 also enforces this at
-- the row level via a raise-on-mutate trigger). Service role bypasses RLS.
-- ============================================================================
alter table public.events enable row level security;

drop policy if exists events_select_own on public.events;
create policy events_select_own on public.events
  for select using (auth.uid() = user_id);

drop policy if exists events_insert_own on public.events;
create policy events_insert_own on public.events
  for insert with check (auth.uid() = user_id);
