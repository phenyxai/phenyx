-- PHE-5: Data Model & Schema Foundation
-- Purpose: Create enums and core tables (user_profiles augmentations, user_persona,
--          constellation_points, constellation_state, waitlist) for the constellation feature.
-- Idempotency: All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / guarded DO blocks.
--              Safe to re-run; will not error on existing objects and will not modify data.
-- See down migration: supabase/migrations/down/20260603120000_phe5_enums_and_tables_down.sql

-- ============================================================================
-- Enums
-- ============================================================================
do $$ begin
  create type pillar_enum as enum ('origin', 'emergence', 'self_creation', 'convergence', 'becoming', 'recognition', 'transcendence');
exception when duplicate_object then null; end $$;

do $$ begin
  create type point_type_enum as enum ('standard', 'follow_up');
exception when duplicate_object then null; end $$;

-- tier_enum is defined now but user_profiles.tier remains `text` for this PR.
-- Converting the existing column requires a `USING tier::tier_enum` cast that
-- would fail on any legacy value outside {free, pro, gifted}. The conversion
-- belongs in a follow-up migration after a data audit of production tier values.
do $$ begin
  create type tier_enum as enum ('free', 'pro', 'gifted');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- user_profiles (table may already exist from earlier work; tier/onairos_data preserved)
-- onairos_data was introduced by 20260502120000_user_profiles_onairos_data.sql.
-- It is re-declared here so a fresh DB replay produces a schema identical to prod.
-- ============================================================================
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  stellar_color text,
  tier text not null default 'free',
  birthday date,
  constellation_age int,
  avatar_url text,
  prompt_times jsonb not null default '{}'::jsonb,
  user_intention text,
  constellation_version int not null default 0,
  onairos_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Defensive ADD COLUMN IF NOT EXISTS for the case where the table predates this migration
alter table public.user_profiles add column if not exists display_name text;
alter table public.user_profiles add column if not exists stellar_color text;
alter table public.user_profiles add column if not exists tier text not null default 'free';
alter table public.user_profiles add column if not exists birthday date;
alter table public.user_profiles add column if not exists constellation_age int;
alter table public.user_profiles add column if not exists avatar_url text;
alter table public.user_profiles add column if not exists prompt_times jsonb not null default '{}'::jsonb;
alter table public.user_profiles add column if not exists user_intention text;
alter table public.user_profiles add column if not exists constellation_version int not null default 0;
alter table public.user_profiles add column if not exists onairos_data jsonb;
alter table public.user_profiles add column if not exists created_at timestamptz not null default now();
alter table public.user_profiles add column if not exists updated_at timestamptz not null default now();

-- ============================================================================
-- user_persona
-- ============================================================================
create table if not exists public.user_persona (
  user_id uuid primary key references auth.users(id) on delete cascade,
  persona_data jsonb not null default '{}'::jsonb,
  connected_platforms text[] not null default '{}'::text[],
  archetype text,
  user_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_persona add column if not exists persona_data jsonb not null default '{}'::jsonb;
alter table public.user_persona add column if not exists connected_platforms text[] not null default '{}'::text[];
alter table public.user_persona add column if not exists archetype text;
alter table public.user_persona add column if not exists user_summary text;
alter table public.user_persona add column if not exists created_at timestamptz not null default now();
alter table public.user_persona add column if not exists updated_at timestamptz not null default now();

-- ============================================================================
-- constellation_points (append-only; enforced via trigger + RLS)
-- ============================================================================
create table if not exists public.constellation_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pillar pillar_enum not null,
  prompt text not null,
  answer text not null,
  type point_type_enum not null,
  created_at timestamptz not null default now()
);

alter table public.constellation_points add column if not exists user_id uuid not null;
alter table public.constellation_points add column if not exists pillar pillar_enum not null;
alter table public.constellation_points add column if not exists prompt text not null;
alter table public.constellation_points add column if not exists answer text not null;
alter table public.constellation_points add column if not exists type point_type_enum not null;
alter table public.constellation_points add column if not exists created_at timestamptz not null default now();

-- ============================================================================
-- constellation_state (PK on user_id => UNIQUE by design)
-- ============================================================================
create table if not exists public.constellation_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  generated_at timestamptz not null default now(),
  version int not null default 1,
  onairos_snapshot jsonb not null default '{}'::jsonb,
  archetype text,
  origin_score int check (origin_score is null or (origin_score >= 0 and origin_score <= 100)),
  origin_synthesis text,
  emergence_score int check (emergence_score is null or (emergence_score >= 0 and emergence_score <= 100)),
  emergence_synthesis text,
  self_creation_score int check (self_creation_score is null or (self_creation_score >= 0 and self_creation_score <= 100)),
  self_creation_synthesis text,
  convergence_score int check (convergence_score is null or (convergence_score >= 0 and convergence_score <= 100)),
  convergence_synthesis text,
  becoming_score int check (becoming_score is null or (becoming_score >= 0 and becoming_score <= 100)),
  becoming_synthesis text,
  recognition_score int check (recognition_score is null or (recognition_score >= 0 and recognition_score <= 100)),
  recognition_synthesis text,
  transcendence_score int check (transcendence_score is null or (transcendence_score >= 0 and transcendence_score <= 100)),
  transcendence_synthesis text,
  portrait jsonb
);

alter table public.constellation_state add column if not exists generated_at timestamptz not null default now();
alter table public.constellation_state add column if not exists version int not null default 1;
alter table public.constellation_state add column if not exists onairos_snapshot jsonb not null default '{}'::jsonb;
alter table public.constellation_state add column if not exists archetype text;
alter table public.constellation_state add column if not exists origin_score int;
alter table public.constellation_state add column if not exists origin_synthesis text;
alter table public.constellation_state add column if not exists emergence_score int;
alter table public.constellation_state add column if not exists emergence_synthesis text;
alter table public.constellation_state add column if not exists self_creation_score int;
alter table public.constellation_state add column if not exists self_creation_synthesis text;
alter table public.constellation_state add column if not exists convergence_score int;
alter table public.constellation_state add column if not exists convergence_synthesis text;
alter table public.constellation_state add column if not exists becoming_score int;
alter table public.constellation_state add column if not exists becoming_synthesis text;
alter table public.constellation_state add column if not exists recognition_score int;
alter table public.constellation_state add column if not exists recognition_synthesis text;
alter table public.constellation_state add column if not exists transcendence_score int;
alter table public.constellation_state add column if not exists transcendence_synthesis text;
alter table public.constellation_state add column if not exists portrait jsonb;

-- ============================================================================
-- waitlist (table predates this migration; defensive only — do NOT touch existing columns)
-- The legacy columns (name, role, platforms, why) are declared here so a fresh DB
-- replay produces a schema identical to environments where waitlist was created
-- ad-hoc in the dashboard. They are intentionally nullable; the current
-- frontend/components/phenyx/waitlist-modal.tsx flow only writes `email`.
-- ============================================================================
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  role text,
  platforms text[],
  why text,
  created_at timestamptz not null default now()
);

alter table public.waitlist add column if not exists name text;
alter table public.waitlist add column if not exists email text;
alter table public.waitlist add column if not exists role text;
alter table public.waitlist add column if not exists platforms text[];
alter table public.waitlist add column if not exists why text;
alter table public.waitlist add column if not exists created_at timestamptz not null default now();

-- Preserve waitlist.email UNIQUE (matches baseline 20260501000000).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.waitlist'::regclass
      and contype  = 'u'
      and conname  = 'waitlist_email_key'
  ) then
    alter table public.waitlist add constraint waitlist_email_key unique (email);
  end if;
exception
  when duplicate_table then null;
  when duplicate_object then null;
end$$;
