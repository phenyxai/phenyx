-- ============================================================================
-- PHE-34: Synthesis engine core — atomic constellation apply.
--
-- What already exists (verified against prior migrations, do NOT recreate):
--   * constellation_state (PK user_id) with version, onairos_snapshot, archetype,
--     the 7 pillar score/synthesis pairs, portrait jsonb  — 20260603120000_phe5
--   * constellation_state.foresight / .mantra                — 20260625120000_phe31
--   * user_traits (append-only, synthesis_version)           — 20260625120000_phe31
--
-- What this migration ADDS:
--   1. constellation_state.last_trigger_event_id — idempotency key so a repeated
--      trigger for the same event does not bump the version twice.
--   2. apply_constellation_synthesis(...) — one transactional RPC that serializes
--      concurrent triggers per user (pg_advisory_xact_lock), performs the versioned
--      upsert (version = version + 1), nulls the derived prose (mantra/foresight,
--      regenerated downstream keyed to the new version), and appends one user_traits
--      row per trait-grounding item. Doing this in a single function guarantees the
--      version advances exactly once per successful run with no lost update.
--
-- Idempotent + re-runnable (ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE), matching
-- the PHE-31 migration style. Local Supabase volume is shared across worktrees, so
-- this must be safe to apply on an already-populated DB.
-- ============================================================================

alter table public.constellation_state
  add column if not exists last_trigger_event_id text;

-- ----------------------------------------------------------------------------
-- apply_constellation_synthesis
--
-- SECURITY DEFINER so it runs with the migration owner's rights (the backend
-- reaches it through the service-role client, which already bypasses RLS; the
-- definer context keeps behaviour identical if the grant is ever widened).
--
-- Returns the resulting version, generated_at, and whether the call was a no-op
-- replay (idempotent = true) so the caller can skip enqueuing downstream jobs.
-- ----------------------------------------------------------------------------
create or replace function public.apply_constellation_synthesis(
  p_user_id                 uuid,
  p_trigger_event_id        text,
  p_archetype               text,
  p_onairos_snapshot        jsonb,
  p_origin_score            int,
  p_origin_synthesis        text,
  p_emergence_score         int,
  p_emergence_synthesis     text,
  p_self_creation_score     int,
  p_self_creation_synthesis text,
  p_convergence_score       int,
  p_convergence_synthesis   text,
  p_portrait_prose          text,
  p_traits                  jsonb
)
returns table (out_version int, out_generated_at timestamptz, out_idempotent boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_row          boolean := false;
  v_existing_trigger text;
  v_version          int;
  v_generated_at     timestamptz;
  v_trait            jsonb;
begin
  -- Serialize concurrent triggers for this user for the life of the transaction.
  -- Two triggers racing on the same user therefore run one-after-another and the
  -- version advances by exactly the number of successful (non-replay) runs.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select true, cs.last_trigger_event_id
    into v_has_row, v_existing_trigger
    from public.constellation_state cs
   where cs.user_id = p_user_id;

  -- Idempotency: replaying the same trigger_event_id returns the current state
  -- untouched — no version bump, no new user_traits rows.
  if p_trigger_event_id is not null
     and v_has_row
     and v_existing_trigger is not distinct from p_trigger_event_id then
    select cs.version, cs.generated_at
      into v_version, v_generated_at
      from public.constellation_state cs
     where cs.user_id = p_user_id;
    return query select v_version, v_generated_at, true;
    return;
  end if;

  insert into public.constellation_state as cs (
    user_id, generated_at, version, onairos_snapshot, archetype,
    origin_score, origin_synthesis,
    emergence_score, emergence_synthesis,
    self_creation_score, self_creation_synthesis,
    convergence_score, convergence_synthesis,
    portrait, mantra, foresight, last_trigger_event_id
  ) values (
    p_user_id, now(), 1, coalesce(p_onairos_snapshot, '{}'::jsonb), p_archetype,
    p_origin_score, p_origin_synthesis,
    p_emergence_score, p_emergence_synthesis,
    p_self_creation_score, p_self_creation_synthesis,
    p_convergence_score, p_convergence_synthesis,
    -- portrait stored as {prose, version}; version matches the row version (1 on
    -- first insert). PHE-36 consumes portrait.prose.
    jsonb_build_object('prose', p_portrait_prose, 'version', 1),
    null, null, p_trigger_event_id
  )
  on conflict (user_id) do update set
    generated_at            = now(),
    version                 = cs.version + 1,
    onairos_snapshot        = excluded.onairos_snapshot,
    archetype               = excluded.archetype,
    origin_score            = excluded.origin_score,
    origin_synthesis        = excluded.origin_synthesis,
    emergence_score         = excluded.emergence_score,
    emergence_synthesis     = excluded.emergence_synthesis,
    self_creation_score     = excluded.self_creation_score,
    self_creation_synthesis = excluded.self_creation_synthesis,
    convergence_score       = excluded.convergence_score,
    convergence_synthesis   = excluded.convergence_synthesis,
    -- cs.version is the pre-update value, so the new version is cs.version + 1.
    portrait                = jsonb_build_object('prose', p_portrait_prose, 'version', cs.version + 1),
    -- Derived prose is regenerated downstream keyed to the NEW version; null it
    -- here so a lazy reader treats it as "needs regeneration" and never serves
    -- prose from the prior version. The 3 locked pillars are intentionally left
    -- untouched (they stay null for the active-4 MVP).
    mantra                  = null,
    foresight               = null,
    last_trigger_event_id   = excluded.last_trigger_event_id
  returning cs.version, cs.generated_at into v_version, v_generated_at;

  -- Append one user_traits row per trait-grounding item, tagged with the new
  -- synthesis version. Append-only (a BEFORE UPDATE/DELETE trigger blocks edits).
  if p_traits is not null and jsonb_typeof(p_traits) = 'array' then
    for v_trait in select * from jsonb_array_elements(p_traits)
    loop
      insert into public.user_traits (user_id, keyword_tags, insight, derived_from, synthesis_version)
      values (
        p_user_id,
        coalesce(
          (select array_agg(t) from jsonb_array_elements_text(v_trait -> 'keyword_tags') as t),
          '{}'::text[]
        ),
        nullif(v_trait ->> 'insight', ''),
        coalesce(
          (select array_agg(d) from jsonb_array_elements_text(v_trait -> 'derived_from') as d),
          '{}'::text[]
        ),
        v_version
      );
    end loop;
  end if;

  return query select v_version, v_generated_at, false;
end;
$$;

grant execute on function public.apply_constellation_synthesis(
  uuid, text, text, jsonb,
  int, text, int, text, int, text, int, text,
  text, jsonb
) to service_role;
