-- PHE-5 DOWN: Revert triggers and functions from 20260603120200_phe5_triggers_append_only.sql

drop trigger if exists constellation_points_no_update    on public.constellation_points;
drop trigger if exists user_profiles_touch_updated_at    on public.user_profiles;
drop trigger if exists user_persona_touch_updated_at     on public.user_persona;

drop function if exists public.phe5_constellation_points_append_only();
drop function if exists public.phe5_touch_updated_at();
