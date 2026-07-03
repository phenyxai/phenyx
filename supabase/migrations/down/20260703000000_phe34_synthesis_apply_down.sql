-- PHE-34 DOWN: Revert 20260703000000_phe34_synthesis_apply.sql
-- Idempotent (safe to re-run). Drops only what the forward migration added; the
-- pre-existing constellation_state columns and user_traits table are untouched.

drop function if exists public.apply_constellation_synthesis(
  uuid, text, text, jsonb,
  int, text, int, text, int, text, int, text,
  text, jsonb
);

alter table public.constellation_state
  drop column if exists last_trigger_event_id;
