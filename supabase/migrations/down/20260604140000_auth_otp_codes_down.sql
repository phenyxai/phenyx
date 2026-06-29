-- PHE-9 DOWN: revert 20260604140000_auth_otp_codes.sql
-- The table was introduced wholesale by PHE-9, so dropping it is safe.

drop table if exists public.otp_codes cascade;
