-- PHE-5 Seed Fixtures
--
-- Three personas for local/dev testing of the constellation data model.
-- Assumes the three UUIDs below already exist in auth.users (seeding auth requires the
-- Supabase admin API — see scripts/seed_auth_users.ts or run via the Supabase dashboard).
--
--   fresh_user      00000000-0000-0000-0000-000000000001
--   returning_user  00000000-0000-0000-0000-000000000002
--   sparse_user     00000000-0000-0000-0000-000000000003
--
-- All inserts use ON CONFLICT DO NOTHING so the script is safe to re-run.

begin;

-- ============================================================================
-- fresh_user: only a user_profiles row, no persona / points / state yet.
-- ============================================================================
insert into public.user_profiles (user_id, display_name, tier)
values ('00000000-0000-0000-0000-000000000001', 'Fresh', 'free')
on conflict (user_id) do nothing;

-- ============================================================================
-- returning_user: profile + persona (nested jsonb) + state v=3 + 12 points
-- ============================================================================
insert into public.user_profiles (user_id, display_name, tier, constellation_version, user_intention)
values ('00000000-0000-0000-0000-000000000002', 'Returning', 'pro', 3, 'understand my arc')
on conflict (user_id) do nothing;

insert into public.user_persona (user_id, persona_data, connected_platforms, archetype, user_summary)
values (
  '00000000-0000-0000-0000-000000000002',
  jsonb_build_object(
    'big_five', jsonb_build_object('openness', 0.82, 'conscientiousness', 0.61),
    'interests', jsonb_build_array('astronomy', 'philosophy', 'cycling'),
    'meta', jsonb_build_object(
      'sources', jsonb_build_array('spotify', 'youtube'),
      'last_sync', '2026-06-01T00:00:00Z'
    )
  ),
  array['spotify', 'youtube']::text[],
  'Seeker',
  'A reflective explorer drawn to systems and meaning.'
)
on conflict (user_id) do nothing;

insert into public.constellation_state (
  user_id, generated_at, version, onairos_snapshot, archetype,
  origin_score, origin_synthesis,
  emergence_score, emergence_synthesis,
  self_creation_score, self_creation_synthesis,
  convergence_score, convergence_synthesis,
  -- locked pillars intentionally NULL
  becoming_score, becoming_synthesis,
  recognition_score, recognition_synthesis,
  transcendence_score, transcendence_synthesis,
  portrait
)
values (
  '00000000-0000-0000-0000-000000000002',
  now(),
  3,
  jsonb_build_object(
    'summary', 'Reflective seeker with strong systems orientation.',
    'tags', jsonb_build_array('curious', 'patient'),
    'scores', jsonb_build_object('novelty', 72, 'consistency', 58)
  ),
  'Seeker',
  71, 'Born of late-night questions and long horizons.',
  64, 'Beginning to crystallize a personal philosophy.',
  58, 'Builds rituals that compound quietly.',
  52, 'Notices threads between disparate fields.',
  null, null,
  null, null,
  null, null,
  jsonb_build_object('palette', jsonb_build_array('#1b1f3a', '#f6e27a'))
)
on conflict (user_id) do nothing;

-- 12 constellation_points across the 4 active pillars (3 each).
insert into public.constellation_points (id, user_id, pillar, prompt, answer, type)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'origin',        'Earliest memory of awe?',           'A meteor shower at age seven.',         'standard'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'origin',        'What did your family hold sacred?', 'Sunday meals and long silences.',       'standard'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'origin',        'Tell me more about that meal.',     'Rituals taught me presence.',           'follow_up'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'emergence',     'When did you feel most yourself?',  'On a solo bike trip across Oregon.',    'standard'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'emergence',     'A risk that shaped you?',           'Leaving a stable job to study design.', 'standard'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'emergence',     'What did the bike trip teach you?', 'I do not need permission.',             'follow_up'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'self_creation', 'A practice that grounds you?',      'Morning pages, every day.',             'standard'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'self_creation', 'Something you are building?',       'A small studio for slow software.',     'standard'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'self_creation', 'Why slow software?',                'Because attention is moral.',           'follow_up'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'convergence',   'An unexpected pattern you noticed?','Music and architecture rhyme.',         'standard'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'convergence',   'Who do you learn from across fields?', 'Gardeners and theoretical physicists.','standard'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'convergence',   'Say more about gardeners.',         'They negotiate with time.',             'follow_up')
on conflict (id) do nothing;

-- ============================================================================
-- sparse_user: profile + state v=1 with 1 pillar populated + 2 points
-- ============================================================================
insert into public.user_profiles (user_id, display_name, tier, constellation_version)
values ('00000000-0000-0000-0000-000000000003', 'Sparse', 'free', 1)
on conflict (user_id) do nothing;

insert into public.constellation_state (
  user_id, generated_at, version, onairos_snapshot, archetype,
  origin_score, origin_synthesis,
  emergence_score, emergence_synthesis,
  self_creation_score, self_creation_synthesis,
  convergence_score, convergence_synthesis,
  becoming_score, becoming_synthesis,
  recognition_score, recognition_synthesis,
  transcendence_score, transcendence_synthesis,
  portrait
)
values (
  '00000000-0000-0000-0000-000000000003',
  now(),
  1,
  jsonb_build_object('summary', 'Just starting.'),
  null,
  44, 'A quiet beginning, room to grow.',
  null, null,
  null, null,
  null, null,
  null, null,
  null, null,
  null, null,
  null
)
on conflict (user_id) do nothing;

insert into public.constellation_points (id, user_id, pillar, prompt, answer, type)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'origin', 'A place that feels like home?', 'The lake at dusk.', 'standard'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000003', 'origin', 'Why dusk?',                     'Edges of things hold meaning.', 'follow_up')
on conflict (id) do nothing;

commit;
