-- PHE-43 DOWN: Revert 20260703000000_phe43_events_event_id_idempotency.sql
-- Idempotent (safe to re-run).
--
-- Scope: removes ONLY what the PHE-43 forward migration adds — the
-- `(user_id, event_id)` unique index and the `event_id` column. The `events`
-- table and everything else are owned by PHE-31 and dropped by that migration's
-- down, not here.

drop index if exists public.events_user_event_id_key;
alter table public.events drop column if exists event_id;
