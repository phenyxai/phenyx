-- PHE-5 Acceptance Verification
--
-- Run after applying all 20260603120* migrations. Each DO block raises NOTICE on PASS
-- or EXCEPTION on FAIL. The script cleans up its own verification rows at the end.
--
-- Usage: psql ... -f supabase/verification/phe5_acceptance.sql
--
-- Uses a dedicated verification user UUID. The check uses gen_random_uuid()-style
-- temporary IDs but for FK satisfaction we reference a known seed user. If you have
-- the PHE-5 seed loaded, the returning_user UUID is used; otherwise create a temp
-- auth.users row via the admin API before running.

-- Pin verification user id (matches returning_user from phe5_seed.sql).
-- If absent in auth.users, create it via Supabase admin API first.
do $$
declare
  v_user uuid := '00000000-0000-0000-0000-000000000002';
begin
  if not exists (select 1 from auth.users where id = v_user) then
    raise exception 'verification user % missing from auth.users — load phe5_seed prerequisites first', v_user;
  end if;
  raise notice 'verification user present';
end $$;

-- ----------------------------------------------------------------------------
-- 1) All five tables exist
-- ----------------------------------------------------------------------------
do $$
declare
  expected text[] := array['user_profiles', 'user_persona', 'constellation_points', 'constellation_state', 'waitlist'];
  t text;
begin
  foreach t in array expected loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      raise exception 'FAIL: expected table public.% missing', t;
    end if;
  end loop;
  raise notice 'PASS: all five tables exist';
end $$;

-- ----------------------------------------------------------------------------
-- 2) constellation_state ON CONFLICT increments version twice
-- ----------------------------------------------------------------------------
do $$
declare
  v_user uuid := '00000000-0000-0000-0000-000000000002';
  v_start int;
  v_after_two int;
begin
  -- Ensure a row exists; capture starting version.
  insert into public.constellation_state (user_id, version)
  values (v_user, 1)
  on conflict (user_id) do nothing;

  select version into v_start from public.constellation_state where user_id = v_user;

  -- Two canonical upserts (mirroring application code path).
  insert into public.constellation_state (user_id, onairos_snapshot, archetype)
  values (v_user, '{"k":"v1"}'::jsonb, 'TestArc')
  on conflict (user_id) do update set
    onairos_snapshot = excluded.onairos_snapshot,
    archetype = excluded.archetype,
    generated_at = now(),
    version = public.constellation_state.version + 1;

  insert into public.constellation_state (user_id, onairos_snapshot, archetype)
  values (v_user, '{"k":"v2"}'::jsonb, 'TestArc')
  on conflict (user_id) do update set
    onairos_snapshot = excluded.onairos_snapshot,
    archetype = excluded.archetype,
    generated_at = now(),
    version = public.constellation_state.version + 1;

  select version into v_after_two from public.constellation_state where user_id = v_user;

  if v_after_two - v_start <> 2 then
    raise exception 'FAIL: expected version delta=2, got % (start=%, after=%)', v_after_two - v_start, v_start, v_after_two;
  end if;
  raise notice 'PASS: constellation_state version increments by 2 on two upserts';
end $$;

-- ----------------------------------------------------------------------------
-- 3) constellation_points UPDATE raises
-- ----------------------------------------------------------------------------
do $$
declare
  v_user uuid := '00000000-0000-0000-0000-000000000002';
  v_id   uuid;
  v_raised boolean := false;
begin
  insert into public.constellation_points (user_id, pillar, prompt, answer, type)
  values (v_user, 'origin', '__verify_prompt__', '__verify_answer__', 'standard')
  returning id into v_id;

  begin
    update public.constellation_points set answer = 'tampered' where id = v_id;
  exception when others then
    v_raised := true;
  end;

  if not v_raised then
    raise exception 'FAIL: UPDATE on constellation_points was permitted';
  end if;
  raise notice 'PASS: constellation_points UPDATE raises exception';
end $$;

-- ----------------------------------------------------------------------------
-- 4) constellation_points DELETE raises
-- ----------------------------------------------------------------------------
do $$
declare
  v_user uuid := '00000000-0000-0000-0000-000000000002';
  v_raised boolean := false;
begin
  begin
    delete from public.constellation_points
    where user_id = v_user and prompt = '__verify_prompt__';
  exception when others then
    v_raised := true;
  end;

  if not v_raised then
    raise exception 'FAIL: DELETE on constellation_points was permitted';
  end if;
  raise notice 'PASS: constellation_points DELETE raises exception';
end $$;

-- ----------------------------------------------------------------------------
-- 5) onairos_snapshot jsonb round-trip with nested object + array
-- ----------------------------------------------------------------------------
do $$
declare
  v_user uuid := '00000000-0000-0000-0000-000000000002';
  v_in   jsonb := jsonb_build_object(
    'nested', jsonb_build_object('a', 1, 'b', jsonb_build_array('x', 'y', 'z')),
    'list', jsonb_build_array(jsonb_build_object('k', 'v'), 42, true, null)
  );
  v_out jsonb;
begin
  insert into public.constellation_state (user_id, onairos_snapshot)
  values (v_user, v_in)
  on conflict (user_id) do update set onairos_snapshot = excluded.onairos_snapshot;

  select onairos_snapshot into v_out from public.constellation_state where user_id = v_user;

  if v_out <> v_in then
    raise exception 'FAIL: jsonb round-trip mismatch. in=%, out=%', v_in, v_out;
  end if;
  raise notice 'PASS: onairos_snapshot jsonb round-trip preserved';
end $$;

-- ----------------------------------------------------------------------------
-- 6) Locked pillar columns are nullable
-- ----------------------------------------------------------------------------
do $$
declare
  cols text[] := array[
    'becoming_score', 'becoming_synthesis',
    'recognition_score', 'recognition_synthesis',
    'transcendence_score', 'transcendence_synthesis'
  ];
  c text;
  v_nullable text;
begin
  foreach c in array cols loop
    select is_nullable into v_nullable
    from information_schema.columns
    where table_schema = 'public' and table_name = 'constellation_state' and column_name = c;

    if v_nullable is null then
      raise exception 'FAIL: column constellation_state.% not found', c;
    end if;
    if v_nullable <> 'YES' then
      raise exception 'FAIL: column constellation_state.% expected nullable, got is_nullable=%', c, v_nullable;
    end if;
  end loop;
  raise notice 'PASS: locked pillar columns are nullable';
end $$;

-- ----------------------------------------------------------------------------
-- 7) Score CHECK rejects 101
-- ----------------------------------------------------------------------------
do $$
declare
  v_user uuid := '00000000-0000-0000-0000-000000000002';
  v_raised boolean := false;
begin
  begin
    insert into public.constellation_state (user_id, origin_score)
    values (v_user, 101)
    on conflict (user_id) do update set origin_score = 101;
  exception when others then
    v_raised := true;
  end;

  if not v_raised then
    raise exception 'FAIL: score CHECK accepted value 101';
  end if;
  raise notice 'PASS: score CHECK rejects 101';
end $$;

-- ----------------------------------------------------------------------------
-- Cleanup verification rows (best-effort; trigger blocks deletes on points, so we
-- disable the trigger session-locally for cleanup, then re-enable).
-- ----------------------------------------------------------------------------
do $$
declare
  v_user uuid := '00000000-0000-0000-0000-000000000002';
begin
  -- Bypass append-only trigger only for verification cleanup.
  alter table public.constellation_points disable trigger constellation_points_no_update;
  delete from public.constellation_points where user_id = v_user and prompt = '__verify_prompt__';
  alter table public.constellation_points enable trigger constellation_points_no_update;

  -- Reset the verification user's state row to a clean baseline (optional).
  update public.constellation_state
  set origin_score = null
  where user_id = v_user and origin_score = 101;

  raise notice 'cleanup complete';
end $$;
