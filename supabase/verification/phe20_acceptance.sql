-- PHE-20 Acceptance Verification
--
-- Run after applying 20260625120000_phe20_voice_standard.sql. Each DO block raises
-- NOTICE on PASS or EXCEPTION on FAIL. Read-only — inserts no rows.
--
-- Usage: psql ... -f supabase/verification/phe20_acceptance.sql

-- ----------------------------------------------------------------------------
-- 1) voice_standard table exists
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'voice_standard'
  ) then
    raise exception 'FAIL: table public.voice_standard missing';
  end if;
  raise notice 'PASS: voice_standard table exists';
end $$;

-- ----------------------------------------------------------------------------
-- 2) Exactly one active row, and it is version 1
-- ----------------------------------------------------------------------------
do $$
declare
  active_count int;
  active_version int;
begin
  select count(*) into active_count from public.voice_standard where is_active;
  if active_count <> 1 then
    raise exception 'FAIL: expected exactly 1 active voice_standard row, found %', active_count;
  end if;

  select version into active_version from public.voice_standard where is_active;
  if active_version <> 1 then
    raise exception 'FAIL: active voice_standard version is %, expected 1', active_version;
  end if;
  raise notice 'PASS: exactly one active voice_standard, version 1';
end $$;

-- ----------------------------------------------------------------------------
-- 3) Seeded body contains the verbatim voice rules + the plain-text instruction
-- ----------------------------------------------------------------------------
do $$
declare
  v_body text;
begin
  select body into v_body from public.voice_standard where version = 1;
  if v_body is null then
    raise exception 'FAIL: version 1 body is null';
  end if;
  if position('a tap on the shoulder, not a verdict.' in v_body) = 0 then
    raise exception 'FAIL: version 1 body missing the verbatim closing rule';
  end if;
  if position('Output plain text only.' in v_body) = 0 then
    raise exception 'FAIL: version 1 body missing the plain-text rendering instruction';
  end if;
  raise notice 'PASS: version 1 body contains the verbatim rules + plain-text instruction';
end $$;

-- ----------------------------------------------------------------------------
-- 4) The one-active partial unique index exists (no-deploy version swap relies on it)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'voice_standard_one_active'
  ) then
    raise exception 'FAIL: partial unique index voice_standard_one_active missing';
  end if;
  raise notice 'PASS: voice_standard_one_active index present';
end $$;
