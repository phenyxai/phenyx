-- PHE-122: a constellation point opens onto its moments (spec doc 2).
--
-- observations: each moment carries a short title, what happened, why it
--   matters, what connects from here and the date it happened. Written once at
--   insert (the table is append-only); older rows leave them null and the
--   client falls back to the body.
-- observation_feedback: "follow this thread" keeps a moment close. The
--   existing verdicts carry "this feels true" (new) and "not quite" (reading).
-- constellation_state.points: per point, the years, place and one-sentence
--   story from the seven-point synthesis.
-- See down migration: supabase/migrations/down/20261016150000_phe122_constellation_moments_down.sql

alter table public.observations
  add column if not exists title text,
  add column if not exists what_happened text,
  add column if not exists why_it_matters text,
  add column if not exists what_connects text,
  add column if not exists occurred_at date;

alter table public.observation_feedback
  add column if not exists following boolean not null default false;

alter table public.constellation_state
  add column if not exists points jsonb;

comment on column public.constellation_state.points is
  'PHE-122: {<pillar>: {years, place, story}} from the seven-point synthesis.';
