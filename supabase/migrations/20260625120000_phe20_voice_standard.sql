-- PHE-20: Polaris Voice Standard
-- Purpose: One DB-backed source of truth for the canonical writing rules that govern
--          every Polaris answer and every observation/synthesis generated in the product.
--          Versioned + is_active so wording can change (and roll back) with no code deploy.
-- Seed: version=1 with the verbatim eight rules from docs/mvp-features/05-polaris.md plus
--       the plain-text rendering instruction appended.
-- Idempotency: IF NOT EXISTS / guarded inserts. Safe to re-run; will not duplicate the seed.
-- See down migration: supabase/migrations/down/20260625120000_phe20_voice_standard_down.sql

-- ============================================================================
-- voice_standard table
-- ============================================================================
create table if not exists public.voice_standard (
  id uuid primary key default gen_random_uuid(),
  version int not null unique,
  body text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Defensive ADD COLUMN IF NOT EXISTS for the case where the table predates this migration.
alter table public.voice_standard add column if not exists version int;
alter table public.voice_standard add column if not exists body text;
alter table public.voice_standard add column if not exists is_active boolean not null default false;
alter table public.voice_standard add column if not exists created_at timestamptz not null default now();

-- At most one row may be active at a time. A partial unique index enforces this:
-- a second `is_active = true` row is rejected, so "flip active version" must be a
-- single transaction that deactivates the old row before/with activating the new one.
create unique index if not exists voice_standard_one_active
  on public.voice_standard (is_active)
  where is_active;

-- ============================================================================
-- Row Level Security
-- The Voice Standard is global, non-user-scoped server config. It is only ever read
-- by the backend via the service-role key (which bypasses RLS). Enable RLS with no
-- policies so anon/authenticated roles cannot read or write it through the Data API.
-- ============================================================================
alter table public.voice_standard enable row level security;

-- ============================================================================
-- Seed version 1 (verbatim eight rules + plain-text rendering instruction)
-- Guarded so re-running the migration does not insert a duplicate version 1.
-- ============================================================================
insert into public.voice_standard (version, body, is_active)
select 1, $voice$you are governed by the polaris voice standard. every observation, synthesis, and answer you write must follow these rules:

- sure tone. no hedging, no rhetorical questions thrown back.
- personal first, data second. never lead with or lean on stats — numbers/sources belong in the meta row, not narrated in prose.
- 2-3 sentences. enough to mean something, not enough to lecture.
- vary sentence structure between entries — don't reuse the same "claim, then two-clause elaboration" shape every time.
- close on something the person would actually want to hear said back to them — resonance, not just an observation.
- plain language only. no words like "arbitrary," "nuanced," "dichotomy," "juxtaposition" — if a word needs a dictionary, it doesn't belong here. write the way you'd actually say this out loud to someone, not the way you'd write it in an essay.
- read like an intuitive human reading of the pattern, not a report on it — generic-sounding "insight" phrasing (the kind that could describe anyone) is a sign to make it more specific to this person, not more elaborate.
- tone is a friend who noticed something and wants to gently tell you, not a narrator describing you from outside. declarative and specific, but soft — a tap on the shoulder, not a verdict.

Output plain text only. No markdown, no HTML, no asterisks, no bold.$voice$, true
where not exists (select 1 from public.voice_standard where version = 1);
