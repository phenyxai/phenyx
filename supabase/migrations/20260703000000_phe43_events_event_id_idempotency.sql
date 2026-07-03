-- PHE-43: Optional idempotency for the analytics events ingest endpoint.
-- Purpose: Add a nullable client-supplied `event_id` to `public.events` and a
--          unique index on `(user_id, event_id)` so the `POST /events` batch
--          endpoint can dedupe retried events (ON CONFLICT DO NOTHING) without
--          the client being able to create a duplicate row for the same id.
-- Delta only: the `events` table, its RLS, indexes, and append-only trigger are
--             owned by PHE-31 (20260625120000) and re-asserted by PHE-35
--             (20260701000000). This migration adds ONLY the idempotency column
--             + index and touches nothing else.
-- Idempotency: ADD COLUMN IF NOT EXISTS + CREATE UNIQUE INDEX IF NOT EXISTS.
--              Safe to re-run.
-- See down migration: supabase/migrations/down/20260703000000_phe43_events_event_id_idempotency_down.sql
--
-- Note on NULLs: Postgres treats NULLs as distinct in a (non-NULLS-NOT-DISTINCT)
-- unique index, so rows WITHOUT an `event_id` (the common case — the PHE-35
-- client queue does not send one) never collide. Only rows carrying the same
-- `(user_id, event_id)` are deduped.

alter table public.events add column if not exists event_id text;

create unique index if not exists events_user_event_id_key
  on public.events (user_id, event_id);
