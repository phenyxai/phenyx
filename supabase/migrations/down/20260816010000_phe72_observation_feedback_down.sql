-- PHE-72 DOWN: Revert 20260816010000_phe72_observation_feedback.sql
-- Idempotent (safe to re-run). Drops only what the forward migration added.

drop trigger if exists observation_feedback_owner_match on public.observation_feedback;
drop function if exists public.phe72_feedback_owner_match();

drop policy if exists observation_feedback_select_own on public.observation_feedback;
drop policy if exists observation_feedback_insert_own on public.observation_feedback;
drop policy if exists observation_feedback_update_own on public.observation_feedback;
drop policy if exists observation_feedback_delete_own on public.observation_feedback;

drop index if exists public.observation_feedback_observation_id_idx;

drop table if exists public.observation_feedback;
