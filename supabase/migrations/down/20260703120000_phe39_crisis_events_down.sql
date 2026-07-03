-- PHE-39 DOWN: Revert 20260703120000_phe39_crisis_events.sql
-- Idempotent (safe to re-run). Drops only what the forward migration added.

drop trigger if exists crisis_events_no_update on public.crisis_events;
drop function if exists public.phe39_append_only();

drop policy if exists crisis_events_select_own on public.crisis_events;

drop index if exists public.crisis_events_user_time_idx;

drop table if exists public.crisis_events;
