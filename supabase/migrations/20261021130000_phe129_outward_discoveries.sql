-- ============================================================================
-- PHE-129: discoveries point outward (Oct 20 demo), and a person can save one.
--
-- A card now names a real place, person, thing to try, detail or medium (or
-- something from the person's own history) with:
--   detail    what it is, one or two sentences
--   reason    why it fits the person, one sentence from their dated sources
--   question  what "ask polaris" opens with
--   story     the public side for "behind this discovery": {label, title,
--             detail}, null for the person's own history
--   saved_at  set by the ★; saved cards outlive their set
-- time_context, what_surfaced and why_now belonged to the inward cards and go.
--
-- The cards are generated and the service regenerates a set on the next
-- visit, so the old ones are deleted rather than migrated: none of them would
-- fit the new fields. Nothing was saved before this migration.
-- See down: supabase/migrations/down/20261021130000_phe129_outward_discoveries_down.sql
-- ============================================================================

delete from public.discoveries;

alter table public.discoveries
  drop constraint if exists discoveries_type_check,
  drop constraint if exists discoveries_headline_check,
  drop column if exists time_context,
  drop column if exists what_surfaced,
  drop column if exists why_now,
  add column if not exists detail text not null check (char_length(detail) > 0),
  add column if not exists reason text not null check (char_length(reason) > 0),
  add column if not exists question text not null check (char_length(question) between 1 and 121),
  add column if not exists story jsonb check (story is null or jsonb_typeof(story) = 'object'),
  add column if not exists saved_at timestamptz,
  add constraint discoveries_type_check check (type in (
    'place', 'person', 'try', 'history', 'detail', 'medium'
  )),
  add constraint discoveries_headline_check check (char_length(headline) between 1 and 73);

create index if not exists discoveries_user_saved_idx
  on public.discoveries (user_id, saved_at desc)
  where saved_at is not null;

comment on table public.discoveries is
  'PHE-103/127 discover cards. Latest set plus saved cards; trail is the dated source trail behind each reason.';
