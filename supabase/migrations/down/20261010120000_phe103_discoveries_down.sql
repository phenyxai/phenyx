-- PHE-103 DOWN: Revert 20261010120000_phe103_discoveries.sql
-- Idempotent (safe to re-run). Drops only what the forward migration added.

drop policy if exists discoveries_select_own on public.discoveries;
drop index if exists public.discoveries_user_created_idx;
drop table if exists public.discoveries;
