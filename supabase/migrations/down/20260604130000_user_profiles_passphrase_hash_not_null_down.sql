-- PHE-11 DOWN: revert 20260604130000_user_profiles_passphrase_hash_not_null.sql
-- Restores the nullable column state that PHE-7 (20260604120000) left in place.
-- Idempotent: `drop not null` is a no-op when the column is already nullable.

alter table public.user_profiles
  alter column passphrase_hash drop not null;
