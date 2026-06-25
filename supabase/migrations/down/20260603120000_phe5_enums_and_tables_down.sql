-- PHE-5 DOWN: Revert enums and tables created by 20260603120000_phe5_enums_and_tables.sql
-- Notes:
--   * user_profiles predates this work — DO NOT DROP. Only drop columns this migration added.
--     Leave tier and onairos_data alone.
--   * waitlist predates this work — DO NOT DROP.

-- Drop tables this migration created.
drop table if exists public.user_persona         cascade;
drop table if exists public.constellation_points cascade;
drop table if exists public.constellation_state  cascade;

-- Conservative rollback: user_profiles columns are NOT dropped here.
-- Reason: user_profiles predates PHE-5, and several of these column names
-- (display_name, avatar_url, created_at, updated_at, etc.) may have existed
-- before this migration. Dropping them in environments where they predate
-- PHE-5 would destroy pre-existing data.
-- If you need to drop a specific column in a known-clean environment, do it
-- manually after verifying it was introduced by PHE-5 in that environment.

-- Drop enums (CASCADE handles any dependent default/check expressions left over).
drop type if exists pillar_enum     cascade;
drop type if exists point_type_enum cascade;
drop type if exists tier_enum       cascade;
