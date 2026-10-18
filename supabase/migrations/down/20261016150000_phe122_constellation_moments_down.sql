alter table public.constellation_state drop column if exists points;
alter table public.observation_feedback drop column if exists following;
alter table public.observations
  drop column if exists occurred_at,
  drop column if exists what_connects,
  drop column if exists why_it_matters,
  drop column if exists what_happened,
  drop column if exists title;
