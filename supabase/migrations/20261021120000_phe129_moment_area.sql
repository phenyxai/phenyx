-- PHE-129: an opened constellation point filters its moments by the part of
-- life they belong to (home, friends, places…), as in the Oct 20 demo.
--
-- observations.area: one or two lowercase words from the observation engine.
--   Written once at insert (the table is append-only); older rows leave it null
--   and the client filters them by platform instead.
-- See down migration: supabase/migrations/down/20261021120000_phe129_moment_area_down.sql

alter table public.observations
  add column if not exists area text;
