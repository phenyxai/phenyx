-- Back to the PHE-103 inward cards. The outward cards (saved ones included)
-- cannot be expressed in the old fields, so they are deleted; the service
-- regenerates a set on the next visit.

delete from public.discoveries;

drop index if exists public.discoveries_user_saved_idx;

alter table public.discoveries
  drop constraint if exists discoveries_type_check,
  drop constraint if exists discoveries_headline_check,
  drop column if exists saved_at,
  drop column if exists story,
  drop column if exists question,
  drop column if exists reason,
  drop column if exists detail,
  add column if not exists time_context text not null check (char_length(time_context) between 1 and 40),
  add column if not exists what_surfaced text not null check (char_length(what_surfaced) > 0),
  add column if not exists why_now text not null check (char_length(why_now) > 0),
  add constraint discoveries_type_check check (type in (
    'resurfaced', 'connection', 'pattern', 'rhythm', 'unfinished thread',
    'memory', 'taste', 'possibility', 'health', 'language', 'network'
  )),
  add constraint discoveries_headline_check check (char_length(headline) between 1 and 60);

comment on table public.discoveries is
  'PHE-103 discover cards. Latest set only; trail is the dated source trail behind each card.';
