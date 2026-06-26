-- PHE-20 DOWN: Revert the voice_standard table created by
-- 20260625120100_phe20_voice_standard.sql.
-- voice_standard is introduced entirely by PHE-20, so a full drop is safe.

drop index if exists public.voice_standard_one_active;
drop table if exists public.voice_standard cascade;
