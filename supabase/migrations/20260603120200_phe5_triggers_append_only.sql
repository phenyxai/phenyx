-- PHE-5: Triggers — append-only enforcement on constellation_points, updated_at touch on
--        user_profiles and user_persona.
-- Idempotency: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS + CREATE TRIGGER.
-- See down migration: supabase/migrations/down/20260603120200_phe5_triggers_append_only_down.sql
--
-- Canonical constellation_state upsert (performed by application code; version bump is atomic
-- inside the single UPDATE — DO NOT bump in application code):
--
--   INSERT INTO constellation_state (
--     user_id, onairos_snapshot, archetype,
--     origin_score, origin_synthesis,
--     emergence_score, emergence_synthesis,
--     self_creation_score, self_creation_synthesis,
--     convergence_score, convergence_synthesis,
--     becoming_score, becoming_synthesis,
--     recognition_score, recognition_synthesis,
--     transcendence_score, transcendence_synthesis,
--     portrait
--   )
--   VALUES (...)
--   ON CONFLICT (user_id) DO UPDATE SET
--     onairos_snapshot = EXCLUDED.onairos_snapshot,
--     archetype = EXCLUDED.archetype,
--     origin_score = EXCLUDED.origin_score,           origin_synthesis = EXCLUDED.origin_synthesis,
--     emergence_score = EXCLUDED.emergence_score,     emergence_synthesis = EXCLUDED.emergence_synthesis,
--     self_creation_score = EXCLUDED.self_creation_score, self_creation_synthesis = EXCLUDED.self_creation_synthesis,
--     convergence_score = EXCLUDED.convergence_score, convergence_synthesis = EXCLUDED.convergence_synthesis,
--     becoming_score = EXCLUDED.becoming_score,       becoming_synthesis = EXCLUDED.becoming_synthesis,
--     recognition_score = EXCLUDED.recognition_score, recognition_synthesis = EXCLUDED.recognition_synthesis,
--     transcendence_score = EXCLUDED.transcendence_score, transcendence_synthesis = EXCLUDED.transcendence_synthesis,
--     portrait = EXCLUDED.portrait,
--     generated_at = now(),
--     version = constellation_state.version + 1;

-- ============================================================================
-- Append-only enforcement on constellation_points
-- ============================================================================
create or replace function public.phe5_constellation_points_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'constellation_points is append-only';
end;
$$;

drop trigger if exists constellation_points_no_update on public.constellation_points;
create trigger constellation_points_no_update
  before update or delete on public.constellation_points
  for each row execute function public.phe5_constellation_points_append_only();

-- ============================================================================
-- updated_at touch trigger for user_profiles & user_persona
-- ============================================================================
create or replace function public.phe5_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_profiles_touch_updated_at on public.user_profiles;
create trigger user_profiles_touch_updated_at
  before update on public.user_profiles
  for each row execute function public.phe5_touch_updated_at();

drop trigger if exists user_persona_touch_updated_at on public.user_persona;
create trigger user_persona_touch_updated_at
  before update on public.user_persona
  for each row execute function public.phe5_touch_updated_at();
