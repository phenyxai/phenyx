-- PHE-97 DOWN: revert 20261009140000_phe97_signup_drafts_passphrase_optional.sql
-- Drafts are short-lived (~15 min) staging rows; ones staged without a
-- passphrase cannot satisfy NOT NULL, so they are dropped before restoring it.
delete from public.signup_drafts where passphrase_hash is null;
alter table public.signup_drafts alter column passphrase_hash set not null;
