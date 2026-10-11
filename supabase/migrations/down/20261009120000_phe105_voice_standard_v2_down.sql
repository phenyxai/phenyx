-- PHE-105 DOWN: Revert 20261009120000_phe105_voice_standard_v2.sql.
-- Reactivates v1 (deactivating v2 first, for the one-active index) and removes v2.

update public.voice_standard set is_active = false where version = 2;
update public.voice_standard set is_active = true where version = 1;
delete from public.voice_standard where version = 2;
