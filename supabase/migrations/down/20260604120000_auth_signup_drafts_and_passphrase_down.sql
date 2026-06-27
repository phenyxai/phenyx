-- PHE-7 DOWN: revert 20260604120000_auth_signup_drafts_and_passphrase.sql
-- Both the columns and the table were introduced by PHE-7, so dropping them is
-- safe (unlike the PHE-5 user_profiles columns, which predated that migration).

drop table if exists public.signup_drafts cascade;

alter table public.user_profiles drop column if exists passphrase_hash;
alter table public.user_profiles drop column if exists passphrase_algo;
