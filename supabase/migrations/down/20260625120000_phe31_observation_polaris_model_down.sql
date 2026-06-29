-- PHE-31 DOWN: Revert 20260625120000_phe31_observation_polaris_model.sql
-- Fully reverses the forward migration and is itself idempotent (safe to re-run).
--
-- Note 1: constellation_points was never touched by the forward migration, so it is
--         not referenced here either.
-- Note 2: DROP TABLE ... CASCADE removes each table's own policies, indexes, and
--         append-only/touch triggers, so those are not dropped individually. (An
--         explicit `DROP TRIGGER/POLICY IF EXISTS ... ON <table>` would *error* once
--         the table is already gone, breaking re-runnability.) Only the schema-level
--         functions and the trigger on the surviving user_profiles table are dropped
--         explicitly.

-- ----------------------------------------------------------------------------
-- stellar_color immutability trigger lives on user_profiles, which survives — drop
-- it explicitly (table always present, so IF EXISTS is safe on re-run).
-- ----------------------------------------------------------------------------
drop trigger if exists user_profiles_stellar_color_immutable on public.user_profiles;

-- ----------------------------------------------------------------------------
-- Tables (reverse FK order: polaris_messages before polaris_conversations).
-- CASCADE also removes their policies, indexes, and append-only/touch triggers.
-- ----------------------------------------------------------------------------
drop table if exists public.events                cascade;
drop table if exists public.polaris_token_usage   cascade;
drop table if exists public.polaris_messages      cascade;
drop table if exists public.polaris_conversations cascade;
drop table if exists public.onairos_connections   cascade;
drop table if exists public.user_traits           cascade;
drop table if exists public.observations          cascade;

-- ----------------------------------------------------------------------------
-- Schema-level functions (dropped after the triggers that referenced them).
-- ----------------------------------------------------------------------------
drop function if exists public.phe31_stellar_color_immutable();
drop function if exists public.phe31_touch_updated_at();
drop function if exists public.phe31_append_only();

-- ----------------------------------------------------------------------------
-- constellation_state columns added by the forward migration.
-- ----------------------------------------------------------------------------
alter table public.constellation_state drop column if exists mantra;
alter table public.constellation_state drop column if exists foresight;

-- ----------------------------------------------------------------------------
-- Optional enums created by the forward migration.
-- ----------------------------------------------------------------------------
drop type if exists event_type_enum         cascade;
drop type if exists observation_source_enum cascade;
