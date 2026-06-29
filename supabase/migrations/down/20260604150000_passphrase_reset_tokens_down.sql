-- PHE-12 DOWN: revert 20260604150000_passphrase_reset_tokens.sql
-- The table was introduced wholesale by PHE-12, so dropping it is safe.

drop table if exists public.passphrase_reset_tokens cascade;
