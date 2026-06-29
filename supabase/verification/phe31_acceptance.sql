-- PHE-31 Acceptance Verification
--
-- Run after applying all migrations (supabase db reset). Each DO block raises NOTICE
-- on PASS or EXCEPTION on FAIL; a failure aborts the script loudly. The script cleans
-- up its own verification rows at the end (disabling append-only triggers locally for
-- the cleanup of immutable tables, then re-enabling them).
--
-- Usage: psql "$DB_URL" -f supabase/verification/phe31_acceptance.sql
--
-- Prerequisites (same convention as phe5_acceptance.sql): two seed users must exist
-- in auth.users. Create them via the Supabase admin API before running.
--   user A (returning_user) 00000000-0000-0000-0000-000000000002
--   user B (sparse_user)    00000000-0000-0000-0000-000000000003

-- ----------------------------------------------------------------------------
-- Pre-cleanup: clear any leftover verification rows from a previously aborted run
-- so this script is safe to re-run. Append-only triggers are disabled locally for
-- the immutable tables, then re-enabled.
-- ----------------------------------------------------------------------------
do $$
declare
  v_a uuid := '00000000-0000-0000-0000-000000000002';
begin
  alter table public.observations disable trigger observations_no_update;
  delete from public.observations where user_id = v_a and signal_hash in ('__verify_signal_dup__', '__verify_signal_rls__');
  alter table public.observations enable trigger observations_no_update;

  alter table public.events disable trigger events_no_update;
  delete from public.events where user_id = v_a and event_type = '__verify_event__';
  alter table public.events enable trigger events_no_update;

  delete from public.polaris_token_usage where user_id = v_a and week = date '2000-01-03';
end $$;

-- ----------------------------------------------------------------------------
-- 0) Both verification users present in auth.users
-- ----------------------------------------------------------------------------
do $$
declare
  v_a uuid := '00000000-0000-0000-0000-000000000002';
  v_b uuid := '00000000-0000-0000-0000-000000000003';
begin
  if not exists (select 1 from auth.users where id = v_a) then
    raise exception 'verification user A % missing from auth.users — load seed prerequisites first', v_a;
  end if;
  if not exists (select 1 from auth.users where id = v_b) then
    raise exception 'verification user B % missing from auth.users — load seed prerequisites first', v_b;
  end if;
  raise notice 'PASS: both verification users present';
end $$;

-- ----------------------------------------------------------------------------
-- 1) All seven new tables exist
-- ----------------------------------------------------------------------------
do $$
declare
  expected text[] := array[
    'observations', 'user_traits', 'onairos_connections',
    'polaris_conversations', 'polaris_messages', 'polaris_token_usage', 'events'
  ];
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
  raise notice 'PASS: all seven new tables exist';
end $$;

-- ----------------------------------------------------------------------------
-- 2) constellation_state has foresight + mantra columns
-- ----------------------------------------------------------------------------
do $$
declare
  cols text[] := array['foresight', 'mantra'];
  c text;
begin
  foreach c in array cols loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'constellation_state' and column_name = c
    ) then
      raise exception 'FAIL: constellation_state.% missing', c;
    end if;
  end loop;
  raise notice 'PASS: constellation_state has foresight + mantra';
end $$;

-- ----------------------------------------------------------------------------
-- 3) observations dedup — duplicate (user_id, signal_hash) is rejected
-- ----------------------------------------------------------------------------
do $$
declare
  v_a uuid := '00000000-0000-0000-0000-000000000002';
  v_raised boolean := false;
begin
  insert into public.observations (user_id, pillar, body, signal_hash)
  values (v_a, 'origin', '__verify_obs__', '__verify_signal_dup__');

  begin
    insert into public.observations (user_id, pillar, body, signal_hash)
    values (v_a, 'origin', '__verify_obs_2__', '__verify_signal_dup__');
  exception when unique_violation then
    v_raised := true;
  end;

  if not v_raised then
    raise exception 'FAIL: duplicate (user_id, signal_hash) was permitted on observations';
  end if;
  raise notice 'PASS: observations rejects duplicate (user_id, signal_hash)';
end $$;

-- ----------------------------------------------------------------------------
-- 4) observations is append-only — UPDATE raises
-- ----------------------------------------------------------------------------
do $$
declare
  v_a uuid := '00000000-0000-0000-0000-000000000002';
  v_raised boolean := false;
begin
  begin
    update public.observations set body = 'tampered'
    where user_id = v_a and signal_hash = '__verify_signal_dup__';
  exception when others then
    v_raised := true;
  end;

  if not v_raised then
    raise exception 'FAIL: UPDATE on observations was permitted';
  end if;
  raise notice 'PASS: observations UPDATE raises exception';
end $$;

-- ----------------------------------------------------------------------------
-- 5) observations is append-only — DELETE raises
-- ----------------------------------------------------------------------------
do $$
declare
  v_a uuid := '00000000-0000-0000-0000-000000000002';
  v_raised boolean := false;
begin
  begin
    delete from public.observations
    where user_id = v_a and signal_hash = '__verify_signal_dup__';
  exception when others then
    v_raised := true;
  end;

  if not v_raised then
    raise exception 'FAIL: DELETE on observations was permitted';
  end if;
  raise notice 'PASS: observations DELETE raises exception';
end $$;

-- ----------------------------------------------------------------------------
-- 6) events is append-only — UPDATE and DELETE raise
-- ----------------------------------------------------------------------------
do $$
declare
  v_a uuid := '00000000-0000-0000-0000-000000000002';
  v_up boolean := false;
  v_del boolean := false;
begin
  insert into public.events (user_id, event_type, props, occurred_at)
  values (v_a, '__verify_event__', '{}'::jsonb, now());

  begin
    update public.events set event_type = 'tampered' where user_id = v_a and event_type = '__verify_event__';
  exception when others then v_up := true; end;

  begin
    delete from public.events where user_id = v_a and event_type = '__verify_event__';
  exception when others then v_del := true; end;

  if not v_up then raise exception 'FAIL: UPDATE on events was permitted'; end if;
  if not v_del then raise exception 'FAIL: DELETE on events was permitted'; end if;
  raise notice 'PASS: events rejects UPDATE and DELETE';
end $$;

-- ----------------------------------------------------------------------------
-- 7) RLS — cross-user SELECT returns 0 rows; owner SELECT sees own rows
--    Enforced under the non-superuser `authenticated` role with a JWT sub claim.
--    RLS only filters once the role can read at all, so we grant SELECT to
--    `authenticated` for the duration of this check (revoked in cleanup). This
--    mirrors the API-exposed grant Supabase applies in hosted environments; the
--    backend itself uses the service role (BYPASSRLS) and never relies on this.
-- ----------------------------------------------------------------------------
do $$
declare
  v_a uuid := '00000000-0000-0000-0000-000000000002';
  v_b uuid := '00000000-0000-0000-0000-000000000003';
  v_cross int;
  v_own   int;
begin
  -- Ensure user A has at least one observation (insert as superuser bypasses RLS).
  insert into public.observations (user_id, pillar, body, signal_hash)
  values (v_a, 'origin', '__verify_rls__', '__verify_signal_rls__')
  on conflict (user_id, signal_hash) do nothing;

  grant select on public.observations to authenticated;

  -- Act as authenticated user B and try to read user A's rows.
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000003"}';
  select count(*) into v_cross from public.observations where user_id = v_a;
  reset role;

  if v_cross <> 0 then
    raise exception 'FAIL: RLS allowed user B to read % of user A''s observations', v_cross;
  end if;

  -- Act as authenticated user A and confirm own rows are visible.
  set local role authenticated;
  set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-000000000002"}';
  select count(*) into v_own from public.observations where user_id = v_a;
  reset role;

  if v_own < 1 then
    raise exception 'FAIL: RLS hid user A''s own observations (saw %)', v_own;
  end if;

  raise notice 'PASS: RLS denies cross-user reads and allows owner reads';
end $$;

-- ----------------------------------------------------------------------------
-- 8) polaris_token_usage — per-(user, week) upsert increments atomically
-- ----------------------------------------------------------------------------
do $$
declare
  v_a uuid := '00000000-0000-0000-0000-000000000002';
  v_week date := date '2000-01-03';   -- a fixed Monday, isolated from seed data
  v_total int;
begin
  insert into public.polaris_token_usage (user_id, week, tokens_used)
  values (v_a, v_week, 10)
  on conflict (user_id, week) do update set tokens_used = public.polaris_token_usage.tokens_used + excluded.tokens_used;

  insert into public.polaris_token_usage (user_id, week, tokens_used)
  values (v_a, v_week, 5)
  on conflict (user_id, week) do update set tokens_used = public.polaris_token_usage.tokens_used + excluded.tokens_used;

  select tokens_used into v_total from public.polaris_token_usage where user_id = v_a and week = v_week;

  if v_total <> 15 then
    raise exception 'FAIL: expected tokens_used=15 after upserts, got %', v_total;
  end if;
  raise notice 'PASS: polaris_token_usage upsert increments to 15';
end $$;

-- ----------------------------------------------------------------------------
-- 9) stellar_color immutability — changing it after set raises
-- ----------------------------------------------------------------------------
do $$
declare
  v_a uuid := '00000000-0000-0000-0000-000000000002';
  v_orig text;
  v_raised boolean := false;
begin
  -- Set a known color (only if currently null, to respect immutability).
  update public.user_profiles set stellar_color = coalesce(stellar_color, '#abcdef') where user_id = v_a;
  select stellar_color into v_orig from public.user_profiles where user_id = v_a;

  begin
    update public.user_profiles set stellar_color = '#000000' where user_id = v_a;
  exception when others then
    v_raised := true;
  end;

  if not v_raised then
    raise exception 'FAIL: stellar_color was changed after being set';
  end if;
  raise notice 'PASS: stellar_color is immutable once set (held at %)', v_orig;
end $$;

-- ----------------------------------------------------------------------------
-- 10) onairos_connections never stores a JWT — schema has no token/jwt column
-- ----------------------------------------------------------------------------
do $$
declare
  v_bad int;
begin
  select count(*) into v_bad
  from information_schema.columns
  where table_schema = 'public' and table_name = 'onairos_connections'
    and (column_name ilike '%jwt%' or column_name ilike '%token%' or column_name = 'access_token');

  if v_bad <> 0 then
    raise exception 'FAIL: onairos_connections has a token/jwt-like column (count=%)', v_bad;
  end if;
  raise notice 'PASS: onairos_connections has no token/jwt column';
end $$;

-- ----------------------------------------------------------------------------
-- Cleanup verification rows (best-effort). Append-only triggers block deletes on
-- observations/events, so disable them session-locally for cleanup, then re-enable.
-- ----------------------------------------------------------------------------
do $$
declare
  v_a uuid := '00000000-0000-0000-0000-000000000002';
  v_week date := date '2000-01-03';
begin
  alter table public.observations disable trigger observations_no_update;
  delete from public.observations where user_id = v_a and signal_hash in ('__verify_signal_dup__', '__verify_signal_rls__');
  alter table public.observations enable trigger observations_no_update;

  alter table public.events disable trigger events_no_update;
  delete from public.events where user_id = v_a and event_type = '__verify_event__';
  alter table public.events enable trigger events_no_update;

  delete from public.polaris_token_usage where user_id = v_a and week = v_week;

  -- Revoke the transient grant used by the RLS check (§7).
  revoke select on public.observations from authenticated;

  raise notice 'cleanup complete';
end $$;

-- Final banner
do $$ begin raise notice 'PHE-31 ACCEPTANCE: all checks passed'; end $$;
