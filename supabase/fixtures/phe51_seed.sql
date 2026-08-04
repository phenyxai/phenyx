-- PHE-51 v66 evidence hierarchy fixture.
-- Requires the standard returning_user auth fixture:
-- 00000000-0000-0000-0000-000000000002

begin;
set constraints all deferred;

insert into public.generation_runs (
  id, user_id, generation_system, prompt_version, model, input_hash, status,
  started_at, completed_at, usage_input, usage_output, validator_results
)
values
  ('51000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000002', 1, 'v66/system-1/1', 'claude-haiku-4-5', 'phe51-fixture-system-1', 'succeeded', now(), now(), 120, 20, '{"passed":true}'::jsonb),
  ('51000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000002', 2, 'v66/system-2/1', 'claude-opus-5', 'phe51-fixture-system-2', 'succeeded', now(), now(), 180, 44, '{"passed":true}'::jsonb),
  ('51000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000002', 3, 'v66/system-3/1', 'claude-sonnet-5', 'phe51-fixture-system-3', 'succeeded', now(), now(), 90, 18, '{"passed":true}'::jsonb),
  ('51000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000002', 4, 'v66/system-4/1', 'claude-opus-5', 'phe51-fixture-system-4', 'succeeded', now(), now(), 200, 80, '{"passed":true}'::jsonb),
  ('51000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000002', 7, 'v66/system-7/1', 'claude-opus-5', 'phe51-fixture-system-7', 'succeeded', now(), now(), 240, 110, '{"passed":true}'::jsonb)
on conflict (id) do nothing;

insert into public.source_records (
  id, user_id, platform, external_record_id, record_type, occurred_at, ingested_at,
  payload_ciphertext, encryption_version, encryption_metadata,
  content_hash, dedupe_key, schema_version, provenance_status
)
values
  ('51000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000002', 'spotify', 'fixture-play-1', 'play', '2026-07-01T23:10:00Z', now(), decode('70686535312d656e637279707465642d31', 'hex'), 1, '{"algorithm":"aes-256-gcm","key_reference":"fixture-only"}'::jsonb, 'sha256:fixture-record-1', 'spotify:fixture-play-1', 1, 'retained_source'),
  ('51000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000002', 'spotify', 'fixture-play-2', 'play', '2026-07-22T23:35:00Z', now(), decode('70686535312d656e637279707465642d32', 'hex'), 1, '{"algorithm":"aes-256-gcm","key_reference":"fixture-only"}'::jsonb, 'sha256:fixture-record-2', 'spotify:fixture-play-2', 1, 'retained_source')
on conflict (id) do nothing;

insert into public.signals (
  id, user_id, signal_type, extractor_version, deterministic_dedupe_key,
  metric_value, evidence_n, span_start, span_end, canonical_span, record_count,
  sources, version, generation_run_id, schema_version, is_legacy_compatibility
)
values (
  '51000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000002',
  'timing',
  'timing-extractor/1',
  'fixture:spotify:late-window',
  '{"measure":"median_hour","value":23,"unit":"hour_utc"}'::jsonb,
  2,
  '2026-07-01T23:10:00Z',
  '2026-07-22T23:35:00Z',
  '2026-07-01/2026-07-22',
  2,
  array['spotify']::text[],
  1,
  '51000000-0000-0000-0000-000000000101',
  1,
  false
)
on conflict (id) do nothing;

insert into public.signal_source_records (signal_id, source_record_id, user_id)
values
  ('51000000-0000-0000-0000-000000000301', '51000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000002'),
  ('51000000-0000-0000-0000-000000000301', '51000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000002')
on conflict do nothing;

insert into public.areas (
  id, user_id, pillar, label, ordinal, generation_run_id,
  generation_version, schema_version, is_legacy_compatibility
)
values (
  '51000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000002',
  'origin',
  'the late window',
  1,
  '51000000-0000-0000-0000-000000000103',
  2,
  1,
  false
)
on conflict (id) do nothing;

insert into public.area_signal_memberships (area_id, signal_id, user_id, ordinal)
values (
  '51000000-0000-0000-0000-000000000401',
  '51000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000002',
  1
)
on conflict do nothing;

insert into public.observations (
  id, user_id, pillar, body, source_platforms, meta_label, is_new,
  locked_for_free, signal_hash, surfaced_at, created_at,
  area_id, generation_run_id, schema_version, points, signal_type,
  evidence_n, evidence_span, span_start, span_end, record_count, sources,
  prompt_version, model_version
)
values (
  '51000000-0000-0000-0000-000000000501',
  '00000000-0000-0000-0000-000000000002',
  'origin',
  'Across two July plays, both listening sessions began after 23:00.',
  array['spotify']::text[],
  'timing / 22 days',
  true,
  false,
  'phe51_fixture_observation_timing',
  now(),
  now(),
  '51000000-0000-0000-0000-000000000401',
  '51000000-0000-0000-0000-000000000102',
  2,
  '["the earlier play began at 23:10", "the later play began at 23:35"]'::jsonb,
  'timing',
  2,
  '2026-07-01/2026-07-22',
  '2026-07-01T23:10:00Z',
  '2026-07-22T23:35:00Z',
  2,
  array['spotify']::text[],
  'v66/system-2/1',
  'claude-opus-5'
)
on conflict (id) do nothing;

insert into public.observation_signals (observation_id, signal_id, user_id)
values (
  '51000000-0000-0000-0000-000000000501',
  '51000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000002'
)
on conflict do nothing;

insert into public.generated_artifacts (
  id, user_id, artifact_type, pillar, area_id, generation_run_id,
  output, version, schema_version
)
values (
  '51000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000002',
  'area_synthesis',
  'origin',
  '51000000-0000-0000-0000-000000000401',
  '51000000-0000-0000-0000-000000000104',
  '{"synthesis":"your listening record keeps a narrow late window."}'::jsonb,
  1,
  1
)
on conflict (id) do nothing;

insert into public.artifact_observations (artifact_id, observation_id, user_id, ordinal)
values (
  '51000000-0000-0000-0000-000000000601',
  '51000000-0000-0000-0000-000000000501',
  '00000000-0000-0000-0000-000000000002',
  1
)
on conflict do nothing;

insert into public.underneath_readings (
  id, user_id, observation_id, generation_run_id, headline, belief,
  record_evidence, gap, mechanism, tell, basis, hedge, schema_version
)
values (
  '51000000-0000-0000-0000-000000000701',
  '00000000-0000-0000-0000-000000000002',
  '51000000-0000-0000-0000-000000000501',
  '51000000-0000-0000-0000-000000000107',
  'the stated schedule and the retained listening window do not yet align.',
  '{"said":"i listen throughout the day","n":1,"where":"chatgpt"}'::jsonb,
  '[{"src":"spotify","what":"two retained July plays after 23:00"}]'::jsonb,
  'the account names the whole day, while the retained examples land late.',
  'the late window appears to be narrower than the account.',
  'both retained examples begin after 23:00.',
  'two retained Spotify play records.',
  'two examples establish a fixture, not a durable pattern.',
  1
)
on conflict (id) do nothing;

commit;
