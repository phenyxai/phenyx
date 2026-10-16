-- PHE-124: the insights reading (spec doc 5), generated once per constellation
-- version and stored beside the foresight line. The jsonb carries the version
-- it was written for, so the overview can tell a stale reading and queue a
-- fresh one without nulling it on re-synthesis.
-- See down migration: supabase/migrations/down/20261016130000_phe124_constellation_insights_down.sql

alter table public.constellation_state
  add column if not exists insights jsonb;

comment on column public.constellation_state.insights is
  'PHE-124 insights reading: {version, generated_at, becoming_clearer, needs_shape, matters, eras}.';
