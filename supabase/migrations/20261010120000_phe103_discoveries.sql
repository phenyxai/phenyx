-- ============================================================================
-- PHE-103: discoveries, the cards on the discover tab.
--
-- One row per card. A set is the seven cards generated together (`set_id`,
-- `position` 0..6); the service keeps only the latest set per person. The
-- card limits are checked in `backend/src/discover/discover.rules.ts` before
-- insert; the checks here are the backstop. `trail` is the dated source trail,
-- an array of { platform, date, detail }, and `sources` are its platforms.
--
-- Owner-only SELECT; the service role writes and bypasses RLS.
-- See down: supabase/migrations/down/20261010120000_phe103_discoveries_down.sql
-- ============================================================================

create table if not exists public.discoveries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  set_id         uuid not null,
  position       smallint not null check (position between 0 and 6),
  type           text not null check (type in (
                   'resurfaced', 'connection', 'pattern', 'rhythm', 'unfinished thread',
                   'memory', 'taste', 'possibility', 'health', 'language', 'network'
                 )),
  pillar         pillar_enum not null,
  time_context   text not null check (char_length(time_context) between 1 and 40),
  headline       text not null check (char_length(headline) between 1 and 60),
  what_surfaced  text not null check (char_length(what_surfaced) > 0),
  why_now        text not null check (char_length(why_now) > 0),
  sources        text[] not null default '{}'::text[],
  trail          jsonb not null check (
                   jsonb_typeof(trail) = 'array' and jsonb_array_length(trail) > 0
                 ),
  created_at     timestamptz not null default now(),
  constraint discoveries_set_position_key unique (user_id, set_id, position)
);

create index if not exists discoveries_user_created_idx
  on public.discoveries (user_id, created_at desc);

alter table public.discoveries enable row level security;

drop policy if exists discoveries_select_own on public.discoveries;
create policy discoveries_select_own on public.discoveries
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.discoveries from public, anon;
grant select on table public.discoveries to authenticated;
grant all on table public.discoveries to service_role;

comment on table public.discoveries is
  'PHE-103 discover cards. Latest set only; trail is the dated source trail behind each card.';
