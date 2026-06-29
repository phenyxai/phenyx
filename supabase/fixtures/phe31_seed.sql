-- PHE-31 Seed Fixtures
--
-- Minimal observation + Polaris + analytics rows for local/dev testing of the
-- post-pivot data model. Builds on the PHE-5 personas:
--
--   returning_user  00000000-0000-0000-0000-000000000002
--   sparse_user     00000000-0000-0000-0000-000000000003
--
-- Assumes those UUIDs already exist in auth.users (seed via the Supabase admin API)
-- and that phe5_seed.sql has been loaded (user_profiles rows present).
--
-- All inserts use ON CONFLICT DO NOTHING so the script is safe to re-run.

begin;

-- ============================================================================
-- observations: a small timeline for returning_user — note TWO rows on the
-- 'origin' pillar (proves many-rows-per-pillar, which constellation_points cannot do).
-- ============================================================================
insert into public.observations (user_id, pillar, body, source_platforms, meta_label, is_new, locked_for_free, signal_hash)
values
  ('00000000-0000-0000-0000-000000000002', 'origin',    'Your listening history leans toward long, contemplative records late at night.', array['spotify']::text[],            'pattern / 3 months', true,  false, 'seed_signal_origin_1'),
  ('00000000-0000-0000-0000-000000000002', 'origin',    'A recurring return to childhood-era artists suggests nostalgia as an anchor.',   array['spotify','youtube']::text[], 'cross-platform / 6 months', true, true,  'seed_signal_origin_2'),
  ('00000000-0000-0000-0000-000000000002', 'emergence', 'Your saved articles cluster around career reinvention and creative risk.',        array['linkedin']::text[],          'pattern / 1 month', true,  false, 'seed_signal_emergence_1')
on conflict (user_id, signal_hash) do nothing;

-- ============================================================================
-- user_traits: one versioned grounding row tied to constellation_state.version = 3.
-- ============================================================================
insert into public.user_traits (user_id, keyword_tags, insight, derived_from, synthesis_version)
values (
  '00000000-0000-0000-0000-000000000002',
  array['contemplative', 'systems-thinking', 'nostalgia']::text[],
  'Draws meaning from patterns across time and disciplines.',
  array['spotify:top_genres', 'linkedin:saved_articles']::text[],
  3
)
on conflict do nothing;

-- ============================================================================
-- onairos_connections: two platforms, redacted snapshot only (NO JWT).
-- ============================================================================
insert into public.onairos_connections (user_id, platform, status, redacted_snapshot)
values
  ('00000000-0000-0000-0000-000000000002', 'spotify',  'connected', jsonb_build_object('top_genres', jsonb_build_array('ambient', 'jazz'))),
  ('00000000-0000-0000-0000-000000000002', 'linkedin', 'connected', jsonb_build_object('industry', 'design'))
on conflict (user_id, platform) do nothing;

-- ============================================================================
-- polaris_conversations + polaris_messages (body would be encrypted in prod; the
-- seed stores plaintext placeholders so local reads are legible).
-- ============================================================================
insert into public.polaris_conversations (id, user_id, title)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000002', 'First thread')
on conflict (id) do nothing;

insert into public.polaris_messages (conversation_id, user_id, role, body, pillar_tag, token_count)
values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000002', 'user',      '[seed] what does my constellation say about my origin?', 'origin', 18),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000002', 'assistant', '[seed] Your origin pillar centers on contemplative anchors.', 'origin', 42)
on conflict do nothing;

-- ============================================================================
-- polaris_token_usage: one week's meter for returning_user.
-- ============================================================================
insert into public.polaris_token_usage (user_id, week, tokens_used)
values ('00000000-0000-0000-0000-000000000002', date_trunc('week', now())::date, 60)
on conflict (user_id, week) do nothing;

-- ============================================================================
-- events: a couple of analytics rows (structured props only, no message content).
-- ============================================================================
insert into public.events (user_id, event_type, props, occurred_at)
values
  ('00000000-0000-0000-0000-000000000002', 'login',     jsonb_build_object('method', 'magic_link'), now()),
  ('00000000-0000-0000-0000-000000000002', 'tab_visit', jsonb_build_object('tab', 'constellation'), now())
on conflict do nothing;

commit;
