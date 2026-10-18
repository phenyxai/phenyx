-- PHE-102 DOWN: Revert 20261010000000_phe102_new_signals.sql
-- Idempotent (safe to re-run). Drops only what the forward migration added.

drop policy if exists new_signals_select_own on public.new_signals;
drop index if exists public.new_signals_unseen_idx;
drop table if exists public.new_signals;
