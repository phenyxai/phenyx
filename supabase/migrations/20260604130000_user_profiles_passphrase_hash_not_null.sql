-- PHE-11: make user_profiles.passphrase_hash the single, mandatory credential.
-- Purpose: enforce `passphrase_hash text not null`. PHE-7 (20260604120000) added the
--          column as nullable because profile rows are only created at OTP-verify
--          time (PHE-9) with the hash copied from the signup_draft; by the time a
--          profile exists it always has a hash, so NOT NULL is the correct invariant.
-- Idempotency: `set not null` is a no-op when already enforced. Safe to re-run.
-- Safety: the guard refuses (loudly) rather than silently skipping if any legacy
--         row still has a null hash, so a real data problem is never masked. A
--         fresh DB replay has no user_profiles rows, so this is a clean no-op there.
-- Note: there is intentionally NO legacy `key_phrase_hash` column / zxcvbn strength
--       meter to drop — that v1 concept never reached this schema; passphrase_hash
--       is the sole source of truth.
-- See down migration: supabase/migrations/down/20260604130000_user_profiles_passphrase_hash_not_null_down.sql

do $$
declare
  null_count bigint;
begin
  select count(*) into null_count
  from public.user_profiles
  where passphrase_hash is null;

  if null_count > 0 then
    raise exception
      'Cannot enforce user_profiles.passphrase_hash NOT NULL: % row(s) have a null hash. Backfill or remove them, then re-run.',
      null_count;
  end if;

  alter table public.user_profiles
    alter column passphrase_hash set not null;
end $$;
