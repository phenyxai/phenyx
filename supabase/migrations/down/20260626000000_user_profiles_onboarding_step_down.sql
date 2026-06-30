-- PHE-14 DOWN: Revert user_profiles.onboarding_step added by
-- 20260626000000_user_profiles_onboarding_step.sql.
-- user_profiles itself predates this work — DO NOT DROP the table; only remove
-- the column and enum this migration introduced.

alter table public.user_profiles drop column if exists onboarding_step;

-- Drop the enum (CASCADE clears any dependent default/check expression).
drop type if exists onboarding_step cascade;
