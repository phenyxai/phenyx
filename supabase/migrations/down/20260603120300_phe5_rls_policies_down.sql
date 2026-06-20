-- PHE-5 DOWN: Revert RLS policies from 20260603120300_phe5_rls_policies.sql

drop policy if exists user_profiles_select_own        on public.user_profiles;
drop policy if exists user_profiles_insert_own        on public.user_profiles;
drop policy if exists user_profiles_update_own        on public.user_profiles;

drop policy if exists user_persona_select_own         on public.user_persona;
drop policy if exists user_persona_insert_own         on public.user_persona;
drop policy if exists user_persona_update_own         on public.user_persona;

drop policy if exists constellation_state_select_own  on public.constellation_state;
drop policy if exists constellation_state_insert_own  on public.constellation_state;
drop policy if exists constellation_state_update_own  on public.constellation_state;

drop policy if exists constellation_points_select_own on public.constellation_points;
drop policy if exists constellation_points_insert_own on public.constellation_points;

drop policy if exists waitlist_insert_public          on public.waitlist;

alter table public.user_profiles        disable row level security;
alter table public.user_persona         disable row level security;
alter table public.constellation_points disable row level security;
alter table public.constellation_state  disable row level security;
alter table public.waitlist             disable row level security;
