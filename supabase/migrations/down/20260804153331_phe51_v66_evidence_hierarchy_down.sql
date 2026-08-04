-- PHE-51 DOWN: restore the PHE-31 observation schema and behavior.

drop trigger if exists observations_phe51_compat_before_insert on public.observations;
drop trigger if exists observations_phe51_compat_after_insert on public.observations;
drop trigger if exists observations_have_descent on public.observations;
drop trigger if exists observation_signals_preserve_descent on public.observation_signals;
drop trigger if exists generated_artifacts_have_observation on public.generated_artifacts;
drop trigger if exists artifact_observations_preserve_support on public.artifact_observations;
drop trigger if exists areas_have_signal on public.areas;
drop trigger if exists area_signal_memberships_preserve_signal on public.area_signal_memberships;
drop trigger if exists signals_have_source on public.signals;
drop trigger if exists signal_source_records_preserve_source on public.signal_source_records;

drop table if exists public.underneath_readings;
drop table if exists public.artifact_observations;
drop table if exists public.generated_artifacts;
drop table if exists public.observation_signals;

alter table public.observations
  drop constraint if exists observations_generation_run_owner_fkey,
  drop constraint if exists observations_area_owner_pillar_fkey,
  drop constraint if exists observations_id_user_unique,
  drop constraint if exists observations_span_check,
  drop constraint if exists observations_record_count_check,
  drop constraint if exists observations_evidence_n_check,
  drop constraint if exists observations_signal_type_check,
  drop constraint if exists observations_points_array_check,
  drop constraint if exists observations_schema_version_check,
  drop column if exists model_version,
  drop column if exists prompt_version,
  drop column if exists sources,
  drop column if exists record_count,
  drop column if exists span_end,
  drop column if exists span_start,
  drop column if exists evidence_span,
  drop column if exists evidence_n,
  drop column if exists signal_type,
  drop column if exists points,
  drop column if exists schema_version,
  drop column if exists generation_run_id,
  drop column if exists area_id;

drop table if exists public.area_signal_memberships;
drop table if exists public.areas;
drop table if exists public.signal_source_records;
drop table if exists public.signals;
drop table if exists public.source_records;
drop table if exists public.generation_runs;

drop schema if exists phe51_private cascade;

-- Restore the PHE-31 direct-mutation blocker exactly. Its triggers survived.
create or replace function public.phe31_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

drop policy if exists observations_select_own on public.observations;
create policy observations_select_own on public.observations
  for select using (auth.uid() = user_id);
drop policy if exists observations_insert_own on public.observations;
create policy observations_insert_own on public.observations
  for insert with check (auth.uid() = user_id);
