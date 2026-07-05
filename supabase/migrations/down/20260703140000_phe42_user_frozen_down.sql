-- Down for 20260703140000_phe42_user_frozen.sql
-- Drops the account-lifecycle freeze flag. Idempotent (DROP COLUMN IF EXISTS).
alter table public.user_profiles
  drop column if exists frozen;
