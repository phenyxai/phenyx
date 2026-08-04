-- PHE-51 acceptance verification.
-- Usage:
-- psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/fixtures/phe51_seed.sql
-- psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/verification/phe51_acceptance.sql

\set ON_ERROR_STOP on

do $$
declare
  expected text[] := array[
    'generation_runs', 'source_records', 'signals', 'signal_source_records',
    'areas', 'area_signal_memberships', 'observation_signals',
    'generated_artifacts', 'artifact_observations', 'underneath_readings'
  ];
  t text;
begin
  foreach t in array expected loop
    if to_regclass('public.' || t) is null then
      raise exception 'FAIL: public.% is missing', t;
    end if;
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relrowsecurity
    ) then
      raise exception 'FAIL: RLS is not enabled on public.%', t;
    end if;
  end loop;
  raise notice 'PASS: all PHE-51 tables exist with RLS enabled';
end $$;

do $$
declare
  required text[] := array[
    'body', 'source_platforms', 'signal_hash', 'meta_label', 'locked_for_free',
    'area_id', 'generation_run_id', 'schema_version', 'points', 'signal_type',
    'evidence_n', 'evidence_span', 'record_count', 'sources',
    'prompt_version', 'model_version'
  ];
  c text;
begin
  foreach c in array required loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'observations' and column_name = c
    ) then
      raise exception 'FAIL: observations.% is missing', c;
    end if;
  end loop;
  raise notice 'PASS: legacy and v66 observation read fields coexist';
end $$;

do $$
declare
  broken integer;
begin
  select count(*) into broken
  from public.observations o
  where not exists (
    select 1
    from public.observation_signals os
    join public.signals s on s.id = os.signal_id and s.user_id = os.user_id
    join public.signal_source_records ssr on ssr.signal_id = s.id and ssr.user_id = s.user_id
    join public.source_records sr on sr.id = ssr.source_record_id and sr.user_id = ssr.user_id
    where os.observation_id = o.id and os.user_id = o.user_id
  );
  if broken <> 0 then
    raise exception 'FAIL: % observations have no source-record descent', broken;
  end if;

  select count(*) into broken
  from public.observations o
  join public.areas a on a.id = o.area_id
  where a.user_id <> o.user_id or a.pillar <> o.pillar;
  if broken <> 0 then
    raise exception 'FAIL: % observations mismatch their area owner/pillar', broken;
  end if;
  raise notice 'PASS: every observation descends to a source and matches its area pillar';
end $$;

-- An authenticated PHE-31-shaped insert remains valid and receives the full chain.
do $$
declare
  v_id uuid;
  v_body text;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002"}';
  insert into public.observations (
    user_id, pillar, body, source_platforms, meta_label, signal_hash
  ) values (
    '00000000-0000-0000-0000-000000000002', 'emergence',
    'legacy insert compatibility verification', array['spotify']::text[],
    'legacy verification', 'phe51_verify_legacy_insert'
  ) returning id, body into v_id, v_body;
  reset role;

  if v_body <> 'legacy insert compatibility verification' then
    raise exception 'FAIL: old-style observation SELECT shape changed';
  end if;
  if not exists (
    select 1
    from public.observations o
    join public.areas a on a.id = o.area_id and a.is_legacy_compatibility
    join public.observation_signals os on os.observation_id = o.id
    join public.signals s on s.id = os.signal_id and s.is_legacy_compatibility
    join public.signal_source_records ssr on ssr.signal_id = s.id
    join public.source_records sr on sr.id = ssr.source_record_id
      and sr.provenance_status = 'legacy_import'
      and sr.payload_ciphertext is null
    where o.id = v_id and o.schema_version = 1
  ) then
    raise exception 'FAIL: old-style insert did not receive an honest compatibility path';
  end if;
  raise notice 'PASS: old PHE-31 INSERT and SELECT remain compatible';
end $$;

-- Owner reads and cross-owner denial on every new table.
do $$
declare
  tables text[] := array[
    'generation_runs', 'source_records', 'signals', 'signal_source_records',
    'areas', 'area_signal_memberships', 'observation_signals',
    'generated_artifacts', 'artifact_observations', 'underneath_readings'
  ];
  t text;
  n bigint;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002"}';
  foreach t in array tables loop
    execute format('select count(*) from public.%I where user_id = %L', t, '00000000-0000-0000-0000-000000000002') into n;
    if n < 1 then raise exception 'FAIL: owner cannot read public.%', t; end if;
  end loop;

  set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003"}';
  foreach t in array tables loop
    execute format('select count(*) from public.%I where user_id = %L', t, '00000000-0000-0000-0000-000000000002') into n;
    if n <> 0 then raise exception 'FAIL: cross-owner read exposed public.%', t; end if;
  end loop;
  reset role;
  raise notice 'PASS: owner reads succeed and cross-owner reads are denied on every new table';
end $$;

-- Authenticated clients have no mutation privilege on service-controlled tables.
do $$
declare
  tables text[] := array[
    'generation_runs', 'source_records', 'signals', 'signal_source_records',
    'areas', 'area_signal_memberships', 'observation_signals',
    'generated_artifacts', 'artifact_observations', 'underneath_readings'
  ];
  t text;
  denied boolean;
begin
  foreach t in array tables loop
    denied := false;
    begin
      set local role authenticated;
      execute format('insert into public.%I default values', t);
    exception when insufficient_privilege then denied := true;
    end;
    reset role;
    if not denied then raise exception 'FAIL: authenticated INSERT was not denied on public.%', t; end if;

    denied := false;
    begin
      set local role authenticated;
      execute format('update public.%I set user_id = user_id where false', t);
    exception when insufficient_privilege then denied := true;
    end;
    reset role;
    if not denied then raise exception 'FAIL: authenticated UPDATE was not denied on public.%', t; end if;

    denied := false;
    begin
      set local role authenticated;
      execute format('delete from public.%I where false', t);
    exception when insufficient_privilege then denied := true;
    end;
    reset role;
    if not denied then raise exception 'FAIL: authenticated DELETE was not denied on public.%', t; end if;
  end loop;
  raise notice 'PASS: client INSERT/UPDATE/DELETE is denied on service-controlled tables';
end $$;

-- Cross-owner junction attempts fail at the database boundary, even as postgres.
do $$
declare
  denied integer := 0;
  v_other_observation uuid;
begin
  insert into public.source_records (
    id, user_id, platform, external_record_id, record_type, occurred_at,
    payload_ciphertext, encryption_version, encryption_metadata,
    content_hash, dedupe_key, schema_version, provenance_status
  ) values (
    '51000000-0000-0000-0000-000000000299',
    '00000000-0000-0000-0000-000000000002',
    'spotify', 'verify-cross-owner', 'play', now(), decode('7068653531', 'hex'),
    1, '{"algorithm":"fixture"}'::jsonb, 'verify-cross-owner',
    'spotify:verify-cross-owner', 1, 'retained_source'
  );
  insert into public.signals (
    id, user_id, signal_type, extractor_version, deterministic_dedupe_key,
    metric_value, evidence_n, record_count, sources, version,
    generation_run_id, schema_version
  ) values (
    '51000000-0000-0000-0000-000000000399',
    '00000000-0000-0000-0000-000000000002', 'frequency', 'verify/1',
    'verify-cross-owner', '{"count":1}'::jsonb, 1, 1,
    array['spotify']::text[], 1,
    '51000000-0000-0000-0000-000000000101', 1
  );
  insert into public.signal_source_records (signal_id, source_record_id, user_id)
  values (
    '51000000-0000-0000-0000-000000000399',
    '51000000-0000-0000-0000-000000000299',
    '00000000-0000-0000-0000-000000000002'
  );
  select id into v_other_observation
  from public.observations where signal_hash = 'phe51_verify_legacy_insert';

  begin
    insert into public.signal_source_records (signal_id, source_record_id, user_id)
    values ('51000000-0000-0000-0000-000000000301', '51000000-0000-0000-0000-000000000299', '00000000-0000-0000-0000-000000000003');
  exception when foreign_key_violation then denied := denied + 1; end;
  begin
    insert into public.area_signal_memberships (area_id, signal_id, user_id, ordinal)
    values ('51000000-0000-0000-0000-000000000401', '51000000-0000-0000-0000-000000000399', '00000000-0000-0000-0000-000000000003', 99);
  exception when foreign_key_violation then denied := denied + 1; end;
  begin
    insert into public.observation_signals (observation_id, signal_id, user_id)
    values ('51000000-0000-0000-0000-000000000501', '51000000-0000-0000-0000-000000000399', '00000000-0000-0000-0000-000000000003');
  exception when foreign_key_violation then denied := denied + 1; end;
  begin
    insert into public.artifact_observations (artifact_id, observation_id, user_id, ordinal)
    values ('51000000-0000-0000-0000-000000000601', v_other_observation, '00000000-0000-0000-0000-000000000003', 99);
  exception when foreign_key_violation then denied := denied + 1; end;
  if denied <> 4 then raise exception 'FAIL: only %/4 cross-owner junction inserts failed', denied; end if;
  delete from public.signals where id = '51000000-0000-0000-0000-000000000399';
  delete from public.source_records where id = '51000000-0000-0000-0000-000000000299';
  raise notice 'PASS: all cross-owner junction inserts fail';
end $$;

do $$
declare
  bad integer;
begin
  select count(*) into bad
  from information_schema.columns
  where table_schema = 'public'
    and table_name in (
      'generation_runs', 'source_records', 'signals', 'signal_source_records',
      'areas', 'area_signal_memberships', 'observation_signals',
      'generated_artifacts', 'artifact_observations', 'underneath_readings'
    )
    and (
      column_name ilike '%token%' or column_name ilike '%jwt%'
      or column_name ilike '%credential%' or column_name ilike '%password%'
      or column_name ilike '%secret%'
    );
  if bad <> 0 then raise exception 'FAIL: found % token/JWT/credential-like columns', bad; end if;
  raise notice 'PASS: no token, JWT, refresh token, password, or credential columns exist';
end $$;

-- Every FK has an index beginning with its first referencing column.
do $$
declare
  missing text;
begin
  select string_agg(c.conrelid::regclass::text || '.' || c.conname, ', ')
  into missing
  from pg_constraint c
  where c.contype = 'f'
    and c.connamespace = 'public'::regnamespace
    and c.conrelid in (
      'public.generation_runs'::regclass, 'public.source_records'::regclass,
      'public.signals'::regclass, 'public.signal_source_records'::regclass,
      'public.areas'::regclass, 'public.area_signal_memberships'::regclass,
      'public.observations'::regclass, 'public.observation_signals'::regclass,
      'public.generated_artifacts'::regclass, 'public.artifact_observations'::regclass,
      'public.underneath_readings'::regclass
    )
    and not exists (
      select 1 from pg_index i
      where i.indrelid = c.conrelid and i.indisvalid and i.indkey[0] = c.conkey[1]
    );
  if missing is not null then raise exception 'FAIL: FK indexes missing: %', missing; end if;
  raise notice 'PASS: every PHE-51 FK has a supporting index';
end $$;

do $$
declare
  rejected boolean := false;
begin
  begin
    insert into public.signals (
      user_id, signal_type, extractor_version, deterministic_dedupe_key,
      metric_value, record_count, version, schema_version
    ) values (
      '00000000-0000-0000-0000-000000000002', 'reciprocity', 'verify',
      'verify-reciprocity-rejected', '{}'::jsonb, 0, 1, 1
    );
  exception when check_violation then rejected := true; end;
  if not rejected then raise exception 'FAIL: deferred reciprocity type was accepted'; end if;
  raise notice 'PASS: signal taxonomy is exactly the approved ten types';
end $$;

-- The policies must use authenticated plus the scalar-subquery auth.uid pattern.
do $$
declare
  bad integer;
begin
  select count(*) into bad
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'generation_runs', 'source_records', 'signals', 'signal_source_records',
      'areas', 'area_signal_memberships', 'observation_signals',
      'generated_artifacts', 'artifact_observations', 'underneath_readings', 'observations'
    )
    and (
      not ('authenticated'::regrole::oid = any(p.polroles))
      or coalesce(pg_get_expr(p.polqual, p.polrelid), pg_get_expr(p.polwithcheck, p.polrelid))
         not like '%SELECT auth.uid()%'
    );
  if bad <> 0 then raise exception 'FAIL: % policies lack authenticated/scalar auth.uid ownership', bad; end if;
  raise notice 'PASS: RLS policies use authenticated plus scalar owner authorization';
end $$;

-- Service-controlled auth deletion must cascade through immutable and provenance rows.
do $$
declare
  v_user uuid := '00000000-0000-0000-0000-000000000051';
  v_observation uuid;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user,
    'authenticated', 'authenticated', 'phe51-delete@example.test', '',
    now(), now(), now()
  ) on conflict (id) do nothing;

  insert into public.observations (
    user_id, pillar, body, source_platforms, signal_hash
  ) values (
    v_user, 'origin', 'account deletion cascade verification',
    array['spotify']::text[], 'phe51_verify_account_delete'
  ) returning id into v_observation;

  delete from auth.users where id = v_user;

  if exists (select 1 from public.observations where id = v_observation)
     or exists (select 1 from public.source_records where user_id = v_user)
     or exists (select 1 from public.signals where user_id = v_user)
     or exists (select 1 from public.areas where user_id = v_user)
     or exists (select 1 from public.generation_runs where user_id = v_user) then
    raise exception 'FAIL: account delete left PHE-51 rows behind';
  end if;
  raise notice 'PASS: service-controlled account deletion cascades through PHE-51';
end $$;

do $$ begin raise notice 'PHE-51 ACCEPTANCE: all checks passed'; end $$;
