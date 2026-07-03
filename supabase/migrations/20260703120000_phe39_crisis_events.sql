-- ============================================================================
-- PHE-39: Crisis Detection Pre-flight — crisis_events store.
--
-- Append-only audit of crisis pre-flight triggers. Stores ONLY a sha256 hash of
-- the user text (text_hash) — never the plaintext, which is never persisted and
-- never logged. Owner-only RLS: the user may read their own rows; INSERTs come
-- from the backend service-role client (which bypasses RLS), so no owner INSERT
-- policy is granted. No owner UPDATE/DELETE — the feed is immutable, enforced by
-- a raise-on-mutate trigger (reuses the PHE-31 append-only pattern).
--
-- Idempotent + re-runnable (CREATE TABLE/INDEX IF NOT EXISTS, ADD COLUMN IF NOT
-- EXISTS, guarded policies, CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS),
-- matching the PHE-31 / PHE-34 style. The local Supabase volume is shared across
-- worktrees, so this must be safe to apply on an already-populated DB.
--
-- See down migration: supabase/migrations/down/20260703120000_phe39_crisis_events_down.sql
-- ============================================================================

create table if not exists public.crisis_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category    text,                              -- crisis kind label, or null
  text_hash   text not null,                     -- sha256(text) hex — NEVER plaintext
  occurred_at timestamptz not null default now()
);

-- Defensive ADD COLUMN IF NOT EXISTS in case the table predates this migration.
alter table public.crisis_events add column if not exists user_id uuid not null;
alter table public.crisis_events add column if not exists category text;
alter table public.crisis_events add column if not exists text_hash text not null;
alter table public.crisis_events add column if not exists occurred_at timestamptz not null default now();

-- ============================================================================
-- Index — chronological read per user.
-- ============================================================================
create index if not exists crisis_events_user_time_idx
  on public.crisis_events (user_id, occurred_at desc);

-- ============================================================================
-- Row Level Security — owner-only SELECT. No owner INSERT/UPDATE/DELETE: the
-- backend inserts through the service role (bypasses RLS), and the feed is
-- append-only. Idempotency: DROP POLICY IF EXISTS before each CREATE POLICY.
-- ============================================================================
alter table public.crisis_events enable row level security;

drop policy if exists crisis_events_select_own on public.crisis_events;
create policy crisis_events_select_own on public.crisis_events
  for select using (auth.uid() = user_id);

-- ============================================================================
-- Append-only enforcement — reject UPDATE and DELETE at the row level.
-- Idempotency: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS + CREATE.
-- ============================================================================
create or replace function public.phe39_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

drop trigger if exists crisis_events_no_update on public.crisis_events;
create trigger crisis_events_no_update
  before update or delete on public.crisis_events
  for each row execute function public.phe39_append_only();
