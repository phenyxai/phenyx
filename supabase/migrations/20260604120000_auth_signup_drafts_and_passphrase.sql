-- PHE-7: Account Creation — passphrase storage + short-TTL pending signups.
-- Purpose: add user_profiles.passphrase_hash / passphrase_algo columns and create
--          the signup_drafts table (staged signups, written/read by service role).
-- Idempotency: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS. Safe to re-run.
-- See down migration: supabase/migrations/down/20260604120000_auth_signup_drafts_and_passphrase_down.sql

-- ============================================================================
-- user_profiles: passphrase credentials (one-way Argon2id hash + algo tag).
-- The hash is copied from a signup_draft at OTP verify time (PHE-9). Never raw.
-- ============================================================================
alter table public.user_profiles add column if not exists passphrase_hash text;
alter table public.user_profiles add column if not exists passphrase_algo text;

-- ============================================================================
-- signup_drafts: pending signups, ~15 min TTL. Holds the already-hashed
-- passphrase until the email OTP is verified; the auth.users + user_profiles
-- rows are created only on verify. Service-role only (RLS denies anon/auth).
-- ============================================================================
create table if not exists public.signup_drafts (
  draft_id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  passphrase_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Defensive adds for environments where the table predates this migration.
alter table public.signup_drafts add column if not exists name text;
alter table public.signup_drafts add column if not exists email text;
alter table public.signup_drafts add column if not exists passphrase_hash text;
alter table public.signup_drafts add column if not exists expires_at timestamptz;
alter table public.signup_drafts add column if not exists created_at timestamptz not null default now();

-- Lookups by email (verify path) and expiry sweeps.
create index if not exists signup_drafts_email_idx on public.signup_drafts (email);
create index if not exists signup_drafts_expires_at_idx on public.signup_drafts (expires_at);

-- Service-role only: enable RLS with no anon/authenticated policies, so those
-- roles are denied. The backend uses the service-role client, which bypasses RLS.
alter table public.signup_drafts enable row level security;
