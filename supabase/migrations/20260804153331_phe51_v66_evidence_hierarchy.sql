-- PHE-51: v66 evidence hierarchy and compatibility migration.
-- Canonical descent: source_records -> signals -> observations -> areas -> pillar.
-- Existing PHE-31 observation columns and insert/select shapes are preserved.

set lock_timeout = '10s';

create schema if not exists phe51_private;
revoke all on schema phe51_private from public, anon, authenticated;

-- Generation executions are retained independently from their versioned outputs.
create table public.generation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_system smallint not null check (generation_system between 1 and 9),
  prompt_version text not null,
  model text not null,
  input_hash text not null,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'rejected', 'cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  error_information jsonb,
  usage_input integer check (usage_input is null or usage_input >= 0),
  usage_output integer check (usage_output is null or usage_output >= 0),
  validator_results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint generation_runs_terminal_time_check check (
    status not in ('succeeded', 'failed', 'rejected', 'cancelled') or completed_at is not null
  ),
  constraint generation_runs_id_user_unique unique (id, user_id),
  constraint generation_runs_input_version_unique unique (
    user_id, generation_system, input_hash, prompt_version, model
  )
);

-- Tier 1. Retained platform records carry ciphertext; legacy imports explicitly do not.
create table public.source_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  external_record_id text not null,
  record_type text not null,
  occurred_at timestamptz,
  ingested_at timestamptz not null default now(),
  payload_ciphertext bytea,
  encryption_version integer,
  encryption_metadata jsonb,
  content_hash text not null,
  dedupe_key text not null,
  schema_version integer not null default 1 check (schema_version > 0),
  provenance_status text not null check (provenance_status in ('retained_source', 'legacy_import')),
  created_at timestamptz not null default now(),
  constraint source_records_retained_encrypted_check check (
    provenance_status = 'legacy_import'
    or (payload_ciphertext is not null and encryption_version is not null and encryption_version > 0)
  ),
  constraint source_records_legacy_payload_check check (
    provenance_status <> 'legacy_import'
    or (payload_ciphertext is null and encryption_version is null)
  ),
  constraint source_records_encryption_metadata_check check (
    encryption_metadata is null or jsonb_typeof(encryption_metadata) = 'object'
  ),
  constraint source_records_id_user_unique unique (id, user_id),
  constraint source_records_dedupe_unique unique (user_id, platform, dedupe_key)
);

-- Tier 2. signal_type is null only for an honest PHE-31 compatibility signal.
create table public.signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  signal_type text,
  extractor_version text not null,
  deterministic_dedupe_key text not null,
  metric_value jsonb not null,
  evidence_n bigint check (evidence_n is null or evidence_n >= 0),
  span_start timestamptz,
  span_end timestamptz,
  canonical_span text,
  record_count bigint not null check (record_count >= 0),
  sources text[] not null default '{}'::text[],
  version integer not null default 1 check (version > 0),
  supersedes_signal_id uuid,
  generation_run_id uuid,
  schema_version integer not null default 1 check (schema_version > 0),
  is_legacy_compatibility boolean not null default false,
  created_at timestamptz not null default now(),
  constraint signals_type_check check (
    signal_type in ('frequency', 'timing', 'duration', 'sequence', 'recurrence',
                    'vocabulary', 'ratio', 'absence', 'convergence', 'divergence')
    or (signal_type is null and is_legacy_compatibility)
  ),
  constraint signals_metric_object_check check (jsonb_typeof(metric_value) = 'object'),
  constraint signals_span_check check (
    span_start is null or span_end is null or span_end >= span_start
  ),
  constraint signals_not_self_superseding check (supersedes_signal_id is distinct from id),
  constraint signals_id_user_unique unique (id, user_id),
  constraint signals_deterministic_version_unique unique (
    user_id, deterministic_dedupe_key, extractor_version, version
  ),
  constraint signals_supersedes_owner_fkey foreign key (supersedes_signal_id, user_id)
    references public.signals(id, user_id) on delete no action deferrable initially deferred,
  constraint signals_generation_run_owner_fkey foreign key (generation_run_id, user_id)
    references public.generation_runs(id, user_id) on delete no action deferrable initially deferred
);

create table public.signal_source_records (
  signal_id uuid not null,
  source_record_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (signal_id, source_record_id),
  constraint signal_source_records_signal_owner_fkey foreign key (signal_id, user_id)
    references public.signals(id, user_id) on delete cascade,
  constraint signal_source_records_record_owner_fkey foreign key (source_record_id, user_id)
    references public.source_records(id, user_id) on delete cascade
);

-- Tier 4. Three generated positions are supported per pillar and generation version.
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pillar pillar_enum not null,
  label text not null,
  ordinal smallint not null check (ordinal between 1 and 3),
  generation_run_id uuid,
  generation_version integer not null default 1 check (generation_version > 0),
  schema_version integer not null default 1 check (schema_version > 0),
  is_legacy_compatibility boolean not null default false,
  supersedes_area_id uuid,
  created_at timestamptz not null default now(),
  constraint areas_not_self_superseding check (supersedes_area_id is distinct from id),
  constraint areas_id_user_unique unique (id, user_id),
  constraint areas_id_user_pillar_unique unique (id, user_id, pillar),
  constraint areas_slot_unique unique (user_id, pillar, generation_version, ordinal),
  constraint areas_generation_run_owner_fkey foreign key (generation_run_id, user_id)
    references public.generation_runs(id, user_id) on delete no action deferrable initially deferred,
  constraint areas_supersedes_owner_fkey foreign key (supersedes_area_id, user_id)
    references public.areas(id, user_id) on delete no action deferrable initially deferred
);

create table public.area_signal_memberships (
  area_id uuid not null,
  signal_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  ordinal integer not null check (ordinal > 0),
  created_at timestamptz not null default now(),
  primary key (area_id, signal_id),
  constraint area_signal_memberships_area_ordinal_unique unique (area_id, ordinal),
  constraint area_signal_memberships_area_owner_fkey foreign key (area_id, user_id)
    references public.areas(id, user_id) on delete cascade,
  constraint area_signal_memberships_signal_owner_fkey foreign key (signal_id, user_id)
    references public.signals(id, user_id) on delete cascade
);

-- Extend, never replace, PHE-31 observations.
alter table public.observations
  add column area_id uuid,
  add column generation_run_id uuid,
  add column schema_version integer,
  add column points jsonb,
  add column signal_type text,
  add column evidence_n bigint,
  add column evidence_span text,
  add column span_start timestamptz,
  add column span_end timestamptz,
  add column record_count bigint,
  add column sources text[],
  add column prompt_version text,
  add column model_version text;

alter table public.observations
  add constraint observations_schema_version_check check (schema_version > 0),
  add constraint observations_points_array_check check (jsonb_typeof(points) = 'array'),
  add constraint observations_signal_type_check check (
    signal_type is null or signal_type in (
      'frequency', 'timing', 'duration', 'sequence', 'recurrence',
      'vocabulary', 'ratio', 'absence', 'convergence', 'divergence'
    )
  ),
  add constraint observations_evidence_n_check check (evidence_n is null or evidence_n >= 0),
  add constraint observations_record_count_check check (record_count >= 0),
  add constraint observations_span_check check (
    span_start is null or span_end is null or span_end >= span_start
  ),
  add constraint observations_id_user_unique unique (id, user_id),
  add constraint observations_area_owner_pillar_fkey foreign key (area_id, user_id, pillar)
    references public.areas(id, user_id, pillar) on delete no action deferrable initially deferred,
  add constraint observations_generation_run_owner_fkey foreign key (generation_run_id, user_id)
    references public.generation_runs(id, user_id) on delete no action deferrable initially deferred;

create table public.observation_signals (
  observation_id uuid not null,
  signal_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (observation_id, signal_id),
  constraint observation_signals_observation_owner_fkey foreign key (observation_id, user_id)
    references public.observations(id, user_id) on delete cascade,
  constraint observation_signals_signal_owner_fkey foreign key (signal_id, user_id)
    references public.signals(id, user_id) on delete cascade
);

create table public.generated_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  artifact_type text not null check (
    artifact_type in ('area_synthesis', 'pillar_narrative', 'opening_portrait', 'daily_line')
  ),
  pillar pillar_enum,
  area_id uuid,
  generation_run_id uuid not null,
  output jsonb not null,
  version integer not null default 1 check (version > 0),
  schema_version integer not null default 1 check (schema_version > 0),
  supersedes_artifact_id uuid,
  created_at timestamptz not null default now(),
  constraint generated_artifacts_scope_check check (
    (artifact_type = 'area_synthesis' and area_id is not null and pillar is not null)
    or (artifact_type = 'pillar_narrative' and area_id is null and pillar is not null)
    or (artifact_type in ('opening_portrait', 'daily_line') and area_id is null and pillar is null)
  ),
  constraint generated_artifacts_output_object_check check (jsonb_typeof(output) = 'object'),
  constraint generated_artifacts_not_self_superseding check (supersedes_artifact_id is distinct from id),
  constraint generated_artifacts_id_user_unique unique (id, user_id),
  constraint generated_artifacts_generation_run_owner_fkey foreign key (generation_run_id, user_id)
    references public.generation_runs(id, user_id) on delete no action deferrable initially deferred,
  constraint generated_artifacts_area_owner_pillar_fkey foreign key (area_id, user_id, pillar)
    references public.areas(id, user_id, pillar) on delete no action deferrable initially deferred,
  constraint generated_artifacts_supersedes_owner_fkey foreign key (supersedes_artifact_id, user_id)
    references public.generated_artifacts(id, user_id) on delete no action deferrable initially deferred
);

create table public.artifact_observations (
  artifact_id uuid not null,
  observation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  ordinal integer not null check (ordinal > 0),
  created_at timestamptz not null default now(),
  primary key (artifact_id, observation_id),
  constraint artifact_observations_artifact_ordinal_unique unique (artifact_id, ordinal),
  constraint artifact_observations_artifact_owner_fkey foreign key (artifact_id, user_id)
    references public.generated_artifacts(id, user_id) on delete cascade,
  constraint artifact_observations_observation_owner_fkey foreign key (observation_id, user_id)
    references public.observations(id, user_id) on delete cascade
);

create table public.underneath_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  observation_id uuid not null,
  generation_run_id uuid not null,
  headline text not null,
  belief jsonb not null,
  record_evidence jsonb not null,
  gap text not null,
  mechanism text not null,
  tell text not null,
  basis text not null,
  hedge text not null,
  feedback_status text check (feedback_status in ('accepted', 'rejected')),
  feedback_at timestamptz,
  schema_version integer not null default 1 check (schema_version > 0),
  created_at timestamptz not null default now(),
  constraint underneath_feedback_time_check check (
    (feedback_status is null and feedback_at is null)
    or (feedback_status is not null and feedback_at is not null)
  ),
  constraint underneath_belief_object_check check (jsonb_typeof(belief) = 'object'),
  constraint underneath_record_array_check check (jsonb_typeof(record_evidence) = 'array'),
  constraint underneath_readings_id_user_unique unique (id, user_id),
  constraint underneath_readings_observation_owner_fkey foreign key (observation_id, user_id)
    references public.observations(id, user_id) on delete no action deferrable initially deferred,
  constraint underneath_readings_generation_run_owner_fkey foreign key (generation_run_id, user_id)
    references public.generation_runs(id, user_id) on delete no action deferrable initially deferred
);

-- Every FK and every owner/time access path has an explicit supporting index.
create index generation_runs_user_created_idx on public.generation_runs (user_id, created_at desc);
create index source_records_user_ingested_idx on public.source_records (user_id, ingested_at desc);
create index source_records_user_occurred_idx on public.source_records (user_id, occurred_at desc);
create index signals_user_created_idx on public.signals (user_id, created_at desc);
create index signals_supersedes_owner_idx on public.signals (supersedes_signal_id, user_id);
create index signals_generation_run_owner_idx on public.signals (generation_run_id, user_id);
create index signal_source_records_user_idx on public.signal_source_records (user_id);
create index signal_source_records_signal_owner_idx on public.signal_source_records (signal_id, user_id);
create index signal_source_records_record_owner_idx on public.signal_source_records (source_record_id, user_id);
create index areas_user_pillar_idx on public.areas (user_id, pillar, generation_version desc);
create index areas_generation_run_owner_idx on public.areas (generation_run_id, user_id);
create index areas_supersedes_owner_idx on public.areas (supersedes_area_id, user_id);
create index area_signal_memberships_user_idx on public.area_signal_memberships (user_id);
create index area_signal_memberships_area_owner_idx on public.area_signal_memberships (area_id, user_id);
create index area_signal_memberships_signal_owner_idx on public.area_signal_memberships (signal_id, user_id);
create index observations_area_owner_pillar_idx on public.observations (area_id, user_id, pillar);
create index observations_generation_run_owner_idx on public.observations (generation_run_id, user_id);
create index observation_signals_user_idx on public.observation_signals (user_id);
create index observation_signals_observation_owner_idx on public.observation_signals (observation_id, user_id);
create index observation_signals_signal_owner_idx on public.observation_signals (signal_id, user_id);
create index generated_artifacts_user_created_idx on public.generated_artifacts (user_id, created_at desc);
create index generated_artifacts_generation_run_owner_idx on public.generated_artifacts (generation_run_id, user_id);
create index generated_artifacts_area_owner_pillar_idx on public.generated_artifacts (area_id, user_id, pillar);
create index generated_artifacts_supersedes_owner_idx on public.generated_artifacts (supersedes_artifact_id, user_id);
create index artifact_observations_user_idx on public.artifact_observations (user_id);
create index artifact_observations_artifact_owner_idx on public.artifact_observations (artifact_id, user_id);
create index artifact_observations_observation_owner_idx on public.artifact_observations (observation_id, user_id);
create index underneath_readings_user_created_idx on public.underneath_readings (user_id, created_at desc);
create index underneath_readings_observation_owner_idx on public.underneath_readings (observation_id, user_id);
create index underneath_readings_generation_run_owner_idx on public.underneath_readings (generation_run_id, user_id);

-- Build an honest compatibility chain for every already-retained PHE-31 observation.
insert into public.generation_runs (
  user_id, generation_system, prompt_version, model, input_hash, status,
  started_at, completed_at, validator_results
)
select distinct
  o.user_id, 2, 'legacy/phe31', 'legacy/import', 'phe31-legacy-import', 'succeeded',
  min(o.created_at) over (partition by o.user_id), now(),
  '{"compatibility_import":true,"original_generation_metadata_available":false}'::jsonb
from public.observations o
on conflict (user_id, generation_system, input_hash, prompt_version, model) do nothing;

insert into public.areas (
  user_id, pillar, label, ordinal, generation_run_id,
  generation_version, schema_version, is_legacy_compatibility
)
select distinct
  o.user_id, o.pillar, 'legacy observations', 1, r.id, 1, 1, true
from public.observations o
join public.generation_runs r
  on r.user_id = o.user_id
 and r.generation_system = 2
 and r.input_hash = 'phe31-legacy-import'
 and r.prompt_version = 'legacy/phe31'
 and r.model = 'legacy/import'
on conflict (user_id, pillar, generation_version, ordinal) do nothing;

insert into public.source_records (
  user_id, platform, external_record_id, record_type, occurred_at, ingested_at,
  payload_ciphertext, encryption_version, encryption_metadata,
  content_hash, dedupe_key, schema_version, provenance_status
)
select
  o.user_id,
  'legacy_import',
  'phe31-observation:' || o.id::text,
  'observation_compatibility_marker',
  null,
  o.created_at,
  null,
  null,
  '{"original_platform_payload_available":false}'::jsonb,
  'legacy-import:' || o.id::text,
  'phe31-observation:' || o.id::text,
  1,
  'legacy_import'
from public.observations o
on conflict (user_id, platform, dedupe_key) do nothing;

insert into public.signals (
  user_id, signal_type, extractor_version, deterministic_dedupe_key,
  metric_value, evidence_n, canonical_span, record_count, sources,
  version, generation_run_id, schema_version, is_legacy_compatibility
)
select
  o.user_id,
  null,
  'legacy/phe31',
  'phe31-observation:' || o.id::text,
  jsonb_build_object(
    'compatibility_import', true,
    'observation_id', o.id,
    'original_measurement_envelope_available', false
  ),
  null,
  o.meta_label,
  0,
  o.source_platforms,
  1,
  r.id,
  1,
  true
from public.observations o
join public.generation_runs r
  on r.user_id = o.user_id
 and r.generation_system = 2
 and r.input_hash = 'phe31-legacy-import'
 and r.prompt_version = 'legacy/phe31'
 and r.model = 'legacy/import'
on conflict (user_id, deterministic_dedupe_key, extractor_version, version) do nothing;

insert into public.signal_source_records (signal_id, source_record_id, user_id)
select s.id, sr.id, o.user_id
from public.observations o
join public.signals s
  on s.user_id = o.user_id
 and s.deterministic_dedupe_key = 'phe31-observation:' || o.id::text
 and s.extractor_version = 'legacy/phe31'
 and s.version = 1
join public.source_records sr
  on sr.user_id = o.user_id
 and sr.platform = 'legacy_import'
 and sr.dedupe_key = 'phe31-observation:' || o.id::text
on conflict do nothing;

insert into public.area_signal_memberships (area_id, signal_id, user_id, ordinal)
select
  a.id,
  s.id,
  o.user_id,
  row_number() over (partition by a.id order by o.created_at, o.id)::integer
from public.observations o
join public.areas a
  on a.user_id = o.user_id
 and a.pillar = o.pillar
 and a.generation_version = 1
 and a.ordinal = 1
 and a.is_legacy_compatibility
join public.signals s
  on s.user_id = o.user_id
 and s.deterministic_dedupe_key = 'phe31-observation:' || o.id::text
 and s.extractor_version = 'legacy/phe31'
 and s.version = 1
on conflict do nothing;

-- PHE-31's append-only trigger protects normal writes. Disable it only for this
-- controlled one-time metadata backfill, then restore it immediately.
alter table public.observations disable trigger observations_no_update;
update public.observations o
set
  area_id = a.id,
  generation_run_id = r.id,
  schema_version = 1,
  points = '[]'::jsonb,
  signal_type = null,
  evidence_n = null,
  evidence_span = o.meta_label,
  span_start = null,
  span_end = null,
  record_count = 0,
  sources = o.source_platforms,
  prompt_version = 'legacy/phe31',
  model_version = 'legacy/import'
from public.areas a, public.generation_runs r
where a.user_id = o.user_id
  and a.pillar = o.pillar
  and a.generation_version = 1
  and a.ordinal = 1
  and a.is_legacy_compatibility
  and r.user_id = o.user_id
  and r.generation_system = 2
  and r.input_hash = 'phe31-legacy-import'
  and r.prompt_version = 'legacy/phe31'
  and r.model = 'legacy/import';
alter table public.observations enable trigger observations_no_update;

insert into public.observation_signals (observation_id, signal_id, user_id)
select o.id, s.id, o.user_id
from public.observations o
join public.signals s
  on s.user_id = o.user_id
 and s.deterministic_dedupe_key = 'phe31-observation:' || o.id::text
 and s.extractor_version = 'legacy/phe31'
 and s.version = 1
on conflict do nothing;

alter table public.observations
  alter column area_id set not null,
  alter column generation_run_id set not null,
  alter column schema_version set not null,
  alter column points set not null,
  alter column record_count set not null,
  alter column sources set not null,
  alter column prompt_version set not null,
  alter column model_version set not null;

-- Old-shaped INSERTs receive a compatibility chain in the database. This helper
-- is deliberately outside the exposed public schema and cannot be called directly.
create function phe51_private.compat_observation_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid;
  v_area_id uuid;
  v_record_id uuid;
  v_signal_id uuid;
  v_ordinal integer;
begin
  if new.area_id is null and new.generation_run_id is null then
    insert into public.generation_runs (
      user_id, generation_system, prompt_version, model, input_hash, status,
      started_at, completed_at, validator_results
    ) values (
      new.user_id, 2, 'legacy/phe31', 'legacy/import', 'phe31-legacy-import',
      'succeeded', new.created_at, pg_catalog.now(),
      '{"compatibility_import":true,"original_generation_metadata_available":false}'::jsonb
    )
    on conflict (user_id, generation_system, input_hash, prompt_version, model)
      do nothing;

    select r.id into v_run_id
    from public.generation_runs r
    where r.user_id = new.user_id
      and r.generation_system = 2
      and r.input_hash = 'phe31-legacy-import'
      and r.prompt_version = 'legacy/phe31'
      and r.model = 'legacy/import';

    insert into public.areas (
      user_id, pillar, label, ordinal, generation_run_id,
      generation_version, schema_version, is_legacy_compatibility
    ) values (
      new.user_id, new.pillar, 'legacy observations', 1, v_run_id, 1, 1, true
    )
    on conflict (user_id, pillar, generation_version, ordinal)
      do nothing;

    select a.id into v_area_id
    from public.areas a
    where a.user_id = new.user_id
      and a.pillar = new.pillar
      and a.generation_version = 1
      and a.ordinal = 1;

    -- Serialize ordinal assignment for concurrent legacy inserts in one area.
    perform 1 from public.areas a where a.id = v_area_id for update;

    insert into public.source_records (
      user_id, platform, external_record_id, record_type, occurred_at, ingested_at,
      payload_ciphertext, encryption_version, encryption_metadata,
      content_hash, dedupe_key, schema_version, provenance_status
    ) values (
      new.user_id, 'legacy_import', 'phe31-observation:' || new.id::text,
      'observation_compatibility_marker', null, new.created_at, null, null,
      '{"original_platform_payload_available":false}'::jsonb,
      'legacy-import:' || new.id::text, 'phe31-observation:' || new.id::text,
      1, 'legacy_import'
    )
    returning id into v_record_id;

    insert into public.signals (
      user_id, signal_type, extractor_version, deterministic_dedupe_key,
      metric_value, evidence_n, canonical_span, record_count, sources,
      version, generation_run_id, schema_version, is_legacy_compatibility
    ) values (
      new.user_id, null, 'legacy/phe31', 'phe31-observation:' || new.id::text,
      jsonb_build_object(
        'compatibility_import', true,
        'observation_id', new.id,
        'original_measurement_envelope_available', false
      ),
      null, new.meta_label, 0, new.source_platforms, 1, v_run_id, 1, true
    )
    returning id into v_signal_id;

    insert into public.signal_source_records (signal_id, source_record_id, user_id)
    values (v_signal_id, v_record_id, new.user_id);

    select coalesce(max(m.ordinal), 0) + 1 into v_ordinal
    from public.area_signal_memberships m
    where m.area_id = v_area_id;

    insert into public.area_signal_memberships (area_id, signal_id, user_id, ordinal)
    values (v_area_id, v_signal_id, new.user_id, v_ordinal);

    new.area_id := v_area_id;
    new.generation_run_id := v_run_id;
    new.schema_version := 1;
    new.points := '[]'::jsonb;
    new.signal_type := null;
    new.evidence_n := null;
    new.evidence_span := new.meta_label;
    new.span_start := null;
    new.span_end := null;
    new.record_count := 0;
    new.sources := new.source_platforms;
    new.prompt_version := 'legacy/phe31';
    new.model_version := 'legacy/import';
  elsif new.area_id is null or new.generation_run_id is null then
    raise exception 'v66 observation requires both area_id and generation_run_id';
  else
    new.schema_version := coalesce(new.schema_version, 2);
    new.points := coalesce(new.points, '[]'::jsonb);
    new.sources := coalesce(new.sources, new.source_platforms);
  end if;

  return new;
end;
$$;

create function phe51_private.compat_observation_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.schema_version = 1 and new.prompt_version = 'legacy/phe31' then
    insert into public.observation_signals (observation_id, signal_id, user_id)
    select new.id, s.id, new.user_id
    from public.signals s
    where s.user_id = new.user_id
      and s.deterministic_dedupe_key = 'phe31-observation:' || new.id::text
      and s.extractor_version = 'legacy/phe31'
      and s.version = 1;
  end if;
  return null;
end;
$$;

revoke all on function phe51_private.compat_observation_before_insert() from public, anon, authenticated;
revoke all on function phe51_private.compat_observation_after_insert() from public, anon, authenticated;

create trigger observations_phe51_compat_before_insert
  before insert on public.observations
  for each row execute function phe51_private.compat_observation_before_insert();

create trigger observations_phe51_compat_after_insert
  after insert on public.observations
  for each row execute function phe51_private.compat_observation_after_insert();

-- Deferred reverse-cardinality checks allow parent and membership rows to be
-- inserted in either order within one transaction while rejecting broken descent.
create function phe51_private.check_signal_has_source()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_signal_id uuid;
begin
  if tg_table_name = 'signals' then
    v_signal_id := new.id;
  elsif tg_op = 'DELETE' then
    v_signal_id := old.signal_id;
  else
    v_signal_id := new.signal_id;
  end if;

  if exists (select 1 from public.signals s where s.id = v_signal_id)
     and not exists (
       select 1 from public.signal_source_records l where l.signal_id = v_signal_id
     ) then
    raise exception 'signal % must descend to at least one source record', v_signal_id;
  end if;
  return null;
end;
$$;

create function phe51_private.check_area_has_signal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area_id uuid;
begin
  if tg_table_name = 'areas' then
    v_area_id := new.id;
  elsif tg_op = 'DELETE' then
    v_area_id := old.area_id;
  else
    v_area_id := new.area_id;
  end if;

  if exists (select 1 from public.areas a where a.id = v_area_id)
     and not exists (
       select 1 from public.area_signal_memberships m where m.area_id = v_area_id
     ) then
    raise exception 'area % must contain at least one signal', v_area_id;
  end if;
  return null;
end;
$$;

create function phe51_private.check_observation_descent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_observation_id uuid;
  v_observation public.observations%rowtype;
begin
  if tg_table_name = 'observations' then
    v_observation_id := new.id;
  elsif tg_op = 'DELETE' then
    v_observation_id := old.observation_id;
  else
    v_observation_id := new.observation_id;
  end if;

  select * into v_observation
  from public.observations o
  where o.id = v_observation_id;

  if not found then
    return null;
  end if;

  if not exists (
    select 1 from public.observation_signals os
    where os.observation_id = v_observation_id
  ) then
    raise exception 'observation % must link to at least one signal', v_observation_id;
  end if;

  if not exists (
    select 1
    from public.observation_signals os
    join public.area_signal_memberships asm
      on asm.area_id = v_observation.area_id
     and asm.signal_id = os.signal_id
     and asm.user_id = os.user_id
    where os.observation_id = v_observation_id
  ) then
    raise exception 'observation % has no signal supporting its area', v_observation_id;
  end if;

  if v_observation.schema_version >= 2 then
    if v_observation.signal_type is null then
      raise exception 'v66 observation % requires signal_type', v_observation_id;
    end if;
    if not exists (
      select 1
      from public.observation_signals os
      join public.signals s on s.id = os.signal_id and s.user_id = os.user_id
      where os.observation_id = v_observation_id
        and s.signal_type = v_observation.signal_type
    ) then
      raise exception 'observation % signal_type does not match a linked signal', v_observation_id;
    end if;
  end if;

  if not exists (
    select 1 from public.generation_runs r
    where r.id = v_observation.generation_run_id
      and r.user_id = v_observation.user_id
      and r.generation_system = 2
  ) then
    raise exception 'observation % must use a System 2 generation run', v_observation_id;
  end if;

  return null;
end;
$$;

create function phe51_private.check_artifact_has_observation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_artifact_id uuid;
begin
  if tg_table_name = 'generated_artifacts' then
    v_artifact_id := new.id;
  elsif tg_op = 'DELETE' then
    v_artifact_id := old.artifact_id;
  else
    v_artifact_id := new.artifact_id;
  end if;

  if exists (select 1 from public.generated_artifacts a where a.id = v_artifact_id)
     and not exists (
       select 1 from public.artifact_observations ao where ao.artifact_id = v_artifact_id
     ) then
    raise exception 'generated artifact % must link to at least one observation', v_artifact_id;
  end if;
  return null;
end;
$$;

revoke all on function phe51_private.check_signal_has_source() from public, anon, authenticated;
revoke all on function phe51_private.check_area_has_signal() from public, anon, authenticated;
revoke all on function phe51_private.check_observation_descent() from public, anon, authenticated;
revoke all on function phe51_private.check_artifact_has_observation() from public, anon, authenticated;

create constraint trigger signals_have_source
  after insert or update on public.signals
  deferrable initially deferred
  for each row execute function phe51_private.check_signal_has_source();
create constraint trigger signal_source_records_preserve_source
  after update or delete on public.signal_source_records
  deferrable initially deferred
  for each row execute function phe51_private.check_signal_has_source();

create constraint trigger areas_have_signal
  after insert or update on public.areas
  deferrable initially deferred
  for each row execute function phe51_private.check_area_has_signal();
create constraint trigger area_signal_memberships_preserve_signal
  after update or delete on public.area_signal_memberships
  deferrable initially deferred
  for each row execute function phe51_private.check_area_has_signal();

create constraint trigger observations_have_descent
  after insert or update on public.observations
  deferrable initially deferred
  for each row execute function phe51_private.check_observation_descent();
create constraint trigger observation_signals_preserve_descent
  after update or delete on public.observation_signals
  deferrable initially deferred
  for each row execute function phe51_private.check_observation_descent();

create constraint trigger generated_artifacts_have_observation
  after insert or update on public.generated_artifacts
  deferrable initially deferred
  for each row execute function phe51_private.check_artifact_has_observation();
create constraint trigger artifact_observations_preserve_support
  after update or delete on public.artifact_observations
  deferrable initially deferred
  for each row execute function phe51_private.check_artifact_has_observation();

-- Preserve append-only behavior for direct mutation while allowing FK cascades
-- during service-controlled account deletion to complete.
create or replace function public.phe31_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_catalog.pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception '% is append-only', tg_table_name;
end;
$$;

-- Every new public table is RLS-protected. Authenticated clients can read only
-- their rows; ingestion and generation writes stay service-controlled.
alter table public.generation_runs enable row level security;
alter table public.source_records enable row level security;
alter table public.signals enable row level security;
alter table public.signal_source_records enable row level security;
alter table public.areas enable row level security;
alter table public.area_signal_memberships enable row level security;
alter table public.observation_signals enable row level security;
alter table public.generated_artifacts enable row level security;
alter table public.artifact_observations enable row level security;
alter table public.underneath_readings enable row level security;

create policy generation_runs_select_own on public.generation_runs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy source_records_select_own on public.source_records
  for select to authenticated using ((select auth.uid()) = user_id);
create policy signals_select_own on public.signals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy signal_source_records_select_own on public.signal_source_records
  for select to authenticated using ((select auth.uid()) = user_id);
create policy areas_select_own on public.areas
  for select to authenticated using ((select auth.uid()) = user_id);
create policy area_signal_memberships_select_own on public.area_signal_memberships
  for select to authenticated using ((select auth.uid()) = user_id);
create policy observation_signals_select_own on public.observation_signals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy generated_artifacts_select_own on public.generated_artifacts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy artifact_observations_select_own on public.artifact_observations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy underneath_readings_select_own on public.underneath_readings
  for select to authenticated using ((select auth.uid()) = user_id);

-- Replace the PHE-31 observation policies with current owner-scoped forms.
drop policy if exists observations_select_own on public.observations;
create policy observations_select_own on public.observations
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists observations_insert_own on public.observations;
create policy observations_insert_own on public.observations
  for insert to authenticated with check ((select auth.uid()) = user_id);

revoke all on table
  public.generation_runs,
  public.source_records,
  public.signals,
  public.signal_source_records,
  public.areas,
  public.area_signal_memberships,
  public.observation_signals,
  public.generated_artifacts,
  public.artifact_observations,
  public.underneath_readings
from public, anon, authenticated;

grant select on table
  public.generation_runs,
  public.source_records,
  public.signals,
  public.signal_source_records,
  public.areas,
  public.area_signal_memberships,
  public.observation_signals,
  public.generated_artifacts,
  public.artifact_observations,
  public.underneath_readings
to authenticated;

grant all on table
  public.generation_runs,
  public.source_records,
  public.signals,
  public.signal_source_records,
  public.areas,
  public.area_signal_memberships,
  public.observation_signals,
  public.generated_artifacts,
  public.artifact_observations,
  public.underneath_readings
to service_role;

revoke all on public.observations from anon;
grant select, insert on public.observations to authenticated;
grant all on public.observations to service_role;

comment on table public.source_records is
  'Immutable encrypted tier-1 records; legacy_import rows are payload-free compatibility markers, never fabricated platform records.';
comment on column public.signals.signal_type is
  'Exactly one of the ten v66 types; NULL only when is_legacy_compatibility identifies an untyped PHE-31 import.';
comment on column public.observations.body is
  'PHE-31 compatibility field and canonical v66 observation text; retained unchanged.';
