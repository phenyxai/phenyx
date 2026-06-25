-- PHE-31: Observation + Polaris Data Model (post-pivot reconciliation)
-- Purpose: Add the append-only observation feed, trait-grounding store, Onairos
--          connection state, Polaris conversations/messages, the weekly Polaris
--          token meter, and analytics events. Add foresight + mantra columns to
--          constellation_state. Owner-only RLS + append-only triggers everywhere.
--          Enforce stellar_color immutability.
-- Idempotency: CREATE TABLE/INDEX IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, guarded
--              DO blocks for enums/policies, CREATE OR REPLACE FUNCTION + DROP TRIGGER
--              IF EXISTS. Safe to re-run; will not error on existing objects and will
--              not modify data.
-- See down migration: supabase/migrations/down/20260625120000_phe31_observation_polaris_model_down.sql
--
-- ============================================================================
-- constellation_points DRIFT DECISION (do NOT change constellation_points here)
-- ============================================================================
-- There is a known drift on `constellation_points`:
--   * Live/prod DB: a VISUALIZATION table — UNIQUE(user_id, pillar), one row per
--     pillar (x_position, y_position, intensity, color, label, is_active). The
--     synthesis service upserts it with onConflict "user_id,pillar".
--   * PHE-5 migration: a REFLECTION table — (pillar, prompt, answer, type) with a
--     non-unique (user_id, pillar) index and an append-only trigger.
-- These shapes are incompatible, and the observation feed needs MANY rows per
-- pillar over time. Decision: leave `constellation_points` entirely untouched in
-- whatever role a given environment already has it, and route the timeline to the
-- NEW append-only `observations` table below. This migration never references,
-- alters, drops, or renames `constellation_points` — so it applies cleanly against
-- either shape and the existing synthesis upsert keeps working.

-- ============================================================================
-- Optional enums (guarded). Kept optional; columns stay `text` for forward-compat
-- (the analytics queue and platform list evolve faster than DB enums). These types
-- are created for downstream use / documentation but are NOT bound to columns here.
-- ============================================================================
do $$ begin
  create type observation_source_enum as enum ('linkedin', 'spotify', 'youtube', 'instagram', 'reddit', 'pinterest');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_type_enum as enum ('tab_visit', 'tab_duration', 'login', 'upgrade', 'observation_unlock', 'polaris_message');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- observations — append-only feed of "what your data revealed".
-- Many rows per pillar over time. UNIQUE(user_id, signal_hash) for dedup/novelty.
-- ============================================================================
create table if not exists public.observations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  pillar           pillar_enum not null,
  body             text not null,                  -- Voice-Standard prose, 1-3 sentences
  source_platforms text[] not null default '{}'::text[], -- e.g. {linkedin, spotify}
  meta_label       text,                           -- e.g. "cross-platform pattern / 6 months"
  is_new           boolean not null default true,  -- novelty flag for "recently observed"
  locked_for_free  boolean not null default false, -- free tier: only 1 unlocked, rest locked
  signal_hash      text not null,                  -- dedup/novelty key (see Observation Engine)
  surfaced_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

-- Defensive ADD COLUMN IF NOT EXISTS for the case where the table predates this migration.
alter table public.observations add column if not exists user_id uuid not null;
alter table public.observations add column if not exists pillar pillar_enum not null;
alter table public.observations add column if not exists body text not null;
alter table public.observations add column if not exists source_platforms text[] not null default '{}'::text[];
alter table public.observations add column if not exists meta_label text;
alter table public.observations add column if not exists is_new boolean not null default true;
alter table public.observations add column if not exists locked_for_free boolean not null default false;
alter table public.observations add column if not exists signal_hash text not null;
alter table public.observations add column if not exists surfaced_at timestamptz not null default now();
alter table public.observations add column if not exists created_at timestamptz not null default now();

-- ============================================================================
-- user_traits — append-only, versioned trait-grounding store. Internal; never
-- surfaced raw. Keyword tags + insight + provenance, ties to constellation_state.version.
-- ============================================================================
create table if not exists public.user_traits (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  keyword_tags      text[] not null default '{}'::text[],  -- normalized trait keywords
  insight           text,                                  -- 1-line grounded interpretation
  derived_from      text[] not null default '{}'::text[],  -- source signal refs (platform/trait keys)
  synthesis_version int,                                   -- ties to constellation_state.version
  created_at        timestamptz not null default now()
);

alter table public.user_traits add column if not exists user_id uuid not null;
alter table public.user_traits add column if not exists keyword_tags text[] not null default '{}'::text[];
alter table public.user_traits add column if not exists insight text;
alter table public.user_traits add column if not exists derived_from text[] not null default '{}'::text[];
alter table public.user_traits add column if not exists synthesis_version int;
alter table public.user_traits add column if not exists created_at timestamptz not null default now();

-- ============================================================================
-- onairos_connections — per-platform connection state + redacted snapshot.
-- NEVER stores an Onairos JWT/token. UNIQUE(user_id, platform).
-- ============================================================================
create table if not exists public.onairos_connections (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  platform          text not null,                  -- linkedin | spotify | youtube | ...
  status            text not null default 'connected', -- connected | disconnected
  redacted_snapshot jsonb,                          -- trait object snapshot, NO JWT/token
  connected_at      timestamptz not null default now(),
  disconnected_at   timestamptz
);

alter table public.onairos_connections add column if not exists user_id uuid not null;
alter table public.onairos_connections add column if not exists platform text not null;
alter table public.onairos_connections add column if not exists status text not null default 'connected';
alter table public.onairos_connections add column if not exists redacted_snapshot jsonb;
alter table public.onairos_connections add column if not exists connected_at timestamptz not null default now();
alter table public.onairos_connections add column if not exists disconnected_at timestamptz;

-- ============================================================================
-- polaris_conversations — conversation threads (1 per user for MVP, extensible).
-- ============================================================================
create table if not exists public.polaris_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.polaris_conversations add column if not exists user_id uuid not null;
alter table public.polaris_conversations add column if not exists title text;
alter table public.polaris_conversations add column if not exists created_at timestamptz not null default now();
alter table public.polaris_conversations add column if not exists updated_at timestamptz not null default now();

-- ============================================================================
-- polaris_messages — append-only Polaris turns. body AES-256-GCM encrypted at rest
-- (reuse EncryptionService, same pattern as constellation_state synthesis fields).
-- ============================================================================
create table if not exists public.polaris_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.polaris_conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  body            text not null,                 -- AES-256-GCM encrypted at rest
  pillar_tag      pillar_enum,                   -- optional pillar the turn touched
  token_count     int not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.polaris_messages add column if not exists conversation_id uuid not null;
alter table public.polaris_messages add column if not exists user_id uuid not null;
alter table public.polaris_messages add column if not exists role text not null;
alter table public.polaris_messages add column if not exists body text not null;
alter table public.polaris_messages add column if not exists pillar_tag pillar_enum;
alter table public.polaris_messages add column if not exists token_count int not null default 0;
alter table public.polaris_messages add column if not exists created_at timestamptz not null default now();

-- ============================================================================
-- polaris_token_usage — weekly token meter for the Polaris tier gate.
-- PK (user_id, week); per-week upsert with atomic tokens_used = tokens_used + delta.
-- ============================================================================
create table if not exists public.polaris_token_usage (
  user_id     uuid not null references auth.users(id) on delete cascade,
  week        date not null,                     -- ISO week start (Mon), UTC
  tokens_used int not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, week)
);

alter table public.polaris_token_usage add column if not exists tokens_used int not null default 0;
alter table public.polaris_token_usage add column if not exists updated_at timestamptz not null default now();

-- ============================================================================
-- events — append-only analytics engagement events. Structured props only; NO
-- message content ever.
-- ============================================================================
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_type  text not null,                     -- tab_visit | tab_duration | login | upgrade | ...
  props       jsonb not null default '{}'::jsonb, -- structured, NO message content
  occurred_at timestamptz not null,              -- client timestamp (from queue)
  created_at  timestamptz not null default now()
);

alter table public.events add column if not exists user_id uuid not null;
alter table public.events add column if not exists event_type text not null;
alter table public.events add column if not exists props jsonb not null default '{}'::jsonb;
alter table public.events add column if not exists occurred_at timestamptz not null default now();
alter table public.events add column if not exists created_at timestamptz not null default now();

-- ============================================================================
-- constellation_state — add foresight + mantra (1:1 with a synthesis version).
-- portrait jsonb already exists; identity-portrait prose stored there.
-- ============================================================================
alter table public.constellation_state add column if not exists foresight text;
alter table public.constellation_state add column if not exists mantra text;

-- ============================================================================
-- Indexes
-- ============================================================================
create index if not exists observations_user_surfaced_idx
  on public.observations (user_id, surfaced_at desc);
create index if not exists observations_user_pillar_idx
  on public.observations (user_id, pillar);
create unique index if not exists observations_user_signal_idx
  on public.observations (user_id, signal_hash);

create index if not exists user_traits_user_idx
  on public.user_traits (user_id, created_at desc);

create index if not exists polaris_messages_conv_idx
  on public.polaris_messages (conversation_id, created_at);

create index if not exists events_user_time_idx
  on public.events (user_id, occurred_at desc);
create index if not exists events_type_idx
  on public.events (event_type);

-- onairos_connections UNIQUE(user_id, platform) via a unique index (idempotent).
create unique index if not exists onairos_connections_user_platform_idx
  on public.onairos_connections (user_id, platform);

-- ============================================================================
-- Row Level Security — owner-only on every per-user table.
-- Append-only tables (observations, user_traits, polaris_messages, events) get
-- SELECT + INSERT policies only; no owner UPDATE/DELETE (engine mutations such as
-- flipping is_new / locked_for_free go through the service role, which bypasses RLS).
-- Idempotency: every CREATE POLICY is preceded by DROP POLICY IF EXISTS.
-- ============================================================================
alter table public.observations          enable row level security;
alter table public.user_traits           enable row level security;
alter table public.onairos_connections   enable row level security;
alter table public.polaris_conversations enable row level security;
alter table public.polaris_messages      enable row level security;
alter table public.polaris_token_usage   enable row level security;
alter table public.events                enable row level security;

-- observations: owner SELECT + INSERT only (append-only).
drop policy if exists observations_select_own on public.observations;
create policy observations_select_own on public.observations
  for select using (auth.uid() = user_id);
drop policy if exists observations_insert_own on public.observations;
create policy observations_insert_own on public.observations
  for insert with check (auth.uid() = user_id);

-- user_traits: owner SELECT + INSERT only (append-only).
drop policy if exists user_traits_select_own on public.user_traits;
create policy user_traits_select_own on public.user_traits
  for select using (auth.uid() = user_id);
drop policy if exists user_traits_insert_own on public.user_traits;
create policy user_traits_insert_own on public.user_traits
  for insert with check (auth.uid() = user_id);

-- onairos_connections: owner SELECT / INSERT / UPDATE (connect/disconnect). No DELETE.
drop policy if exists onairos_connections_select_own on public.onairos_connections;
create policy onairos_connections_select_own on public.onairos_connections
  for select using (auth.uid() = user_id);
drop policy if exists onairos_connections_insert_own on public.onairos_connections;
create policy onairos_connections_insert_own on public.onairos_connections
  for insert with check (auth.uid() = user_id);
drop policy if exists onairos_connections_update_own on public.onairos_connections;
create policy onairos_connections_update_own on public.onairos_connections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- polaris_conversations: owner SELECT / INSERT / UPDATE (title, updated_at). No DELETE.
drop policy if exists polaris_conversations_select_own on public.polaris_conversations;
create policy polaris_conversations_select_own on public.polaris_conversations
  for select using (auth.uid() = user_id);
drop policy if exists polaris_conversations_insert_own on public.polaris_conversations;
create policy polaris_conversations_insert_own on public.polaris_conversations
  for insert with check (auth.uid() = user_id);
drop policy if exists polaris_conversations_update_own on public.polaris_conversations;
create policy polaris_conversations_update_own on public.polaris_conversations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- polaris_messages: owner SELECT + INSERT only (append-only).
drop policy if exists polaris_messages_select_own on public.polaris_messages;
create policy polaris_messages_select_own on public.polaris_messages
  for select using (auth.uid() = user_id);
drop policy if exists polaris_messages_insert_own on public.polaris_messages;
create policy polaris_messages_insert_own on public.polaris_messages
  for insert with check (auth.uid() = user_id);

-- polaris_token_usage: owner SELECT only. Writes go through the service role
-- (atomic per-week increment); the owner never mutates the meter directly.
drop policy if exists polaris_token_usage_select_own on public.polaris_token_usage;
create policy polaris_token_usage_select_own on public.polaris_token_usage
  for select using (auth.uid() = user_id);

-- events: owner SELECT + INSERT only (append-only).
drop policy if exists events_select_own on public.events;
create policy events_select_own on public.events
  for select using (auth.uid() = user_id);
drop policy if exists events_insert_own on public.events;
create policy events_insert_own on public.events
  for insert with check (auth.uid() = user_id);

-- ============================================================================
-- Append-only enforcement triggers (reuse the PHE-5 raise-on-mutate pattern).
-- Reject UPDATE and DELETE at the row level on the immutable feeds.
-- Idempotency: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS + CREATE TRIGGER.
-- ============================================================================
create or replace function public.phe31_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

drop trigger if exists observations_no_update on public.observations;
create trigger observations_no_update
  before update or delete on public.observations
  for each row execute function public.phe31_append_only();

drop trigger if exists user_traits_no_update on public.user_traits;
create trigger user_traits_no_update
  before update or delete on public.user_traits
  for each row execute function public.phe31_append_only();

drop trigger if exists polaris_messages_no_update on public.polaris_messages;
create trigger polaris_messages_no_update
  before update or delete on public.polaris_messages
  for each row execute function public.phe31_append_only();

drop trigger if exists events_no_update on public.events;
create trigger events_no_update
  before update or delete on public.events
  for each row execute function public.phe31_append_only();

-- updated_at touch trigger for the mutable Polaris/Onairos tables (reuse PHE-5 fn
-- if present, else define an equivalent here so this migration is self-contained).
create or replace function public.phe31_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists polaris_conversations_touch_updated_at on public.polaris_conversations;
create trigger polaris_conversations_touch_updated_at
  before update on public.polaris_conversations
  for each row execute function public.phe31_touch_updated_at();

drop trigger if exists polaris_token_usage_touch_updated_at on public.polaris_token_usage;
create trigger polaris_token_usage_touch_updated_at
  before update on public.polaris_token_usage
  for each row execute function public.phe31_touch_updated_at();

-- ============================================================================
-- stellar_color immutability — once set (non-null), it can never change.
-- Deterministic + immutable: derived once at profile creation from user_id, never
-- re-derived, never user-editable. Enforced here at the DB level (defense in depth
-- alongside the app never exposing an update path).
-- ============================================================================
create or replace function public.phe31_stellar_color_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.stellar_color is not null and new.stellar_color is distinct from old.stellar_color then
    raise exception 'stellar_color is immutable once set (was %, attempted %)', old.stellar_color, new.stellar_color;
  end if;
  return new;
end;
$$;

drop trigger if exists user_profiles_stellar_color_immutable on public.user_profiles;
create trigger user_profiles_stellar_color_immutable
  before update on public.user_profiles
  for each row execute function public.phe31_stellar_color_immutable();
