-- PHE-5 DOWN: Revert indexes from 20260603120100_phe5_indexes_and_constraints.sql

drop index if exists public.constellation_points_user_created_idx;
drop index if exists public.constellation_points_user_pillar_idx;
drop index if exists public.waitlist_email_unique_idx;
