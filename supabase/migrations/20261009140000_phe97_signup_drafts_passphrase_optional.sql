-- PHE-97: sign-in is Google or an email code, so a signup draft no longer
-- carries a passphrase. Relax signup_drafts.passphrase_hash to nullable so the
-- backend can stage name + email only.
--
-- Non-destructive: the column stays (as do user_profiles.passphrase_hash /
-- passphrase_algo, untouched here), so passphrase-era rows keep their data.
-- DROP NOT NULL is a no-op when already nullable, so this is replay-safe.
-- See down migration: supabase/migrations/down/20261009140000_phe97_signup_drafts_passphrase_optional_down.sql
alter table public.signup_drafts alter column passphrase_hash drop not null;
