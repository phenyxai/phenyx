-- =============================================================================
-- PHENYX AUTH STACK — staging migration bundle (id-safe, idempotent)
-- Target: staging Supabase (aieafuibpxyhqpkjecqv). Paste into the SQL editor.
-- Regenerated after dropping the passphrase_hash NOT NULL migration (review #2),
-- so there is NO pre-flight required: passphrase_hash stays nullable and legacy
-- email-only accounts are fine (they simply can't passphrase-login).
-- Sections run sequentially; each is independently idempotent.
-- =============================================================================

-- ===== 20260603120250_user_profiles_id_pk_reconcile.sql =====
-- Reconcile user_profiles primary-key column to `id` (= auth.users.id).
--
-- The baseline (20260501) and phe5 (20260603) migrations create user_profiles
-- with `user_id` as its PK, but the deployed databases (staging/prod) and the
-- entire app + auth code key the table by `id`. This drift means a fresh
-- `supabase db reset` builds a schema the code cannot talk to.
--
-- Rename when a migration-built DB produced `user_id`; no-op where `id` already
-- exists (staging/prod). Postgres rewrites the dependent PK, FK, RLS policies and
-- triggers automatically on RENAME (they bind by attribute number, not name), so
-- no policy/constraint recreation is needed.
--
-- Runs after phe5 (20260603120300) and before the auth column-adds (20260604120000),
-- so the whole auth chain operates on `id`.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'user_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'id'
  ) then
    alter table public.user_profiles rename column user_id to id;
  end if;
end
$$;

-- ===== 20260604120000_auth_signup_drafts_and_passphrase.sql =====
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

-- ===== 20260604140000_auth_otp_codes.sql =====
-- PHE-9: Email OTP delivery & verification — short-lived hashed one-time codes.
-- Purpose: create public.otp_codes, holding a HASHED 6-digit code (never plaintext)
--          per (email, purpose) with a 10-min expiry and an attempt counter. Issuing
--          a new code overwrites the prior row, so there is at most ONE active code
--          per (email, purpose) — enforced structurally by the composite primary key.
-- Idempotency: CREATE TABLE / CREATE INDEX IF NOT EXISTS + defensive ADD COLUMNs.
--          Safe to re-run.
-- Security: service-role only. RLS is enabled with NO anon/authenticated policies,
--           so those roles are denied entirely; the backend's service-role client
--           bypasses RLS. Codes are stored as Argon2id hashes, written/read only by
--           the backend at send/verify time.
-- See down migration: supabase/migrations/down/20260604140000_auth_otp_codes_down.sql

-- ============================================================================
-- otp_codes: one active code per (email, purpose). The composite PK is the
-- "one active code" invariant — OtpService upserts on conflict, replacing the
-- hash + expiry + resetting attempts, which invalidates any previous code.
-- purpose ∈ { signup, signin, reset } (reset reserved for PHE-12).
-- ============================================================================
create table if not exists public.otp_codes (
  email      text        not null,
  purpose    text        not null,
  code_hash  text        not null,
  expires_at timestamptz not null,
  attempts   int         not null default 0,
  created_at timestamptz not null default now(),
  primary key (email, purpose)
);

-- Defensive adds for environments where the table predates this migration.
alter table public.otp_codes add column if not exists code_hash text;
alter table public.otp_codes add column if not exists expires_at timestamptz;
alter table public.otp_codes add column if not exists attempts int not null default 0;
alter table public.otp_codes add column if not exists created_at timestamptz not null default now();

-- Expiry sweeps (a periodic job / verify-time cleanup deletes stale codes).
create index if not exists otp_codes_expires_at_idx on public.otp_codes (expires_at);

-- Service-role only: enable RLS with no policies so anon/authenticated are denied.
-- The backend uses the service-role client, which bypasses RLS.
alter table public.otp_codes enable row level security;

-- ===== 20260604150000_passphrase_reset_tokens.sql =====
-- PHE-12: Sign In + Forgot/Reset Passphrase — single-use passphrase reset tokens.
-- Purpose: create public.passphrase_reset_tokens, holding the KEYED HMAC of a
--          short-TTL reset token (never the raw token) per issued reset link,
--          with the owning user, an expiry, and a single-use marker.
-- Idempotency: CREATE TABLE / CREATE INDEX IF NOT EXISTS + defensive ADD COLUMNs.
--          Safe to re-run.
-- Security: service-role only. RLS is enabled with NO anon/authenticated policies,
--           so those roles are denied entirely; the backend's service-role client
--           bypasses RLS. Only the token's HMAC (EncryptionService.sign) is stored,
--           so a table leak cannot be matched against guessed tokens without the
--           server key.
-- Note on the user_id column: this NEW table FKs auth.users(id) directly — that is
--          correct here. The "key user_profiles by id, not user_id" rule (commit
--          c261f65) is specific to the user_profiles table.
-- See down migration: supabase/migrations/down/20260604150000_passphrase_reset_tokens_down.sql

-- ============================================================================
-- passphrase_reset_tokens: one row per issued reset link.
--   token_hash — PK; HMAC-SHA256(ENCRYPTION_KEY, raw_token), hex. Lookup key at
--                confirm time; uniqueness is structural.
--   user_id    — the account whose passphrase the token resets.
--   expires_at — hard expiry (the backend issues 45-min tokens).
--   used_at    — NULL while live; stamped when consumed. Confirming a reset burns
--                this token AND every other unused token for the user.
-- ============================================================================
create table if not exists public.passphrase_reset_tokens (
  token_hash text        primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

-- Defensive adds for environments where the table predates this migration.
alter table public.passphrase_reset_tokens add column if not exists user_id uuid;
alter table public.passphrase_reset_tokens add column if not exists expires_at timestamptz;
alter table public.passphrase_reset_tokens add column if not exists used_at timestamptz;
alter table public.passphrase_reset_tokens add column if not exists created_at timestamptz not null default now();

-- Burn-all-for-user (on confirm) and expiry sweeps.
create index if not exists passphrase_reset_tokens_user_id_idx on public.passphrase_reset_tokens (user_id);
create index if not exists passphrase_reset_tokens_expires_at_idx on public.passphrase_reset_tokens (expires_at);

-- Service-role only: enable RLS with no policies so anon/authenticated are denied.
-- The backend uses the service-role client, which bypasses RLS.
alter table public.passphrase_reset_tokens enable row level security;

-- ===== 20260604160000_user_profiles_stellar_color_backfill.sql =====
-- PHE-13: deterministic stellar color — backfill null user_profiles.stellar_color.
-- Purpose: every account carries one immutable color from the curated stellar
--          palette, derived from the immutable pair (id + created_at) — NEVER
--          random. Fresh accounts get this at creation time in
--          backend/src/auth/auth.service.ts (completeSignup); this migration
--          assigns the same deterministic color to any pre-existing row whose
--          stellar_color is still null.
-- Idempotency: the UPDATE only touches rows WHERE stellar_color IS NULL, so a
--          re-run is a clean no-op (already-colored rows are immutable and left
--          untouched). The helper function uses CREATE OR REPLACE.
-- Determinism: public.stellar_color_for(id, created_at) mirrors the TypeScript
--          stellarColorFor() byte-for-byte — SHA-256 of (id::text ||
--          to_char(created_at @ UTC, ISO-8601 ms 'Z')), first 7 hex digits read
--          as a 28-bit unsigned int, mod 14, indexed into the SAME 14-color
--          palette. A backfilled row and a freshly-created row therefore resolve
--          to the identical hex for identical inputs. Backend pins created_at to
--          a Date#toISOString() value at insert, which to_char(...,'...MS"Z"')
--          reproduces exactly.
-- Key column: user_profiles is keyed by `id` (= auth.users.id) in the live DB and
--          across the whole auth stack; this migration reads `id` and `created_at`
--          from that table. Guarded so a fresh replay where the table predates the
--          `id` column is a safe no-op rather than an error.
-- See down migration: supabase/migrations/down/20260604160000_user_profiles_stellar_color_backfill_down.sql

-- pgcrypto supplies digest(); on Supabase it installs into the extensions schema.
create extension if not exists pgcrypto with schema extensions;

-- ============================================================================
-- public.stellar_color_for(id, created_at) — the canonical (id, created_at) →
-- palette-hex mapping. IMMUTABLE: identical inputs always yield the same hex.
-- Mirror of stellarColorFor() in backend/src/common/stellar.util.ts and the
-- STELLAR constant in frontend/lib/stellar.ts — keep all three byte-identical.
-- ============================================================================
create or replace function public.stellar_color_for(
  p_id         uuid,
  p_created_at timestamptz
)
returns text
language sql
immutable
as $$
  select (array[
    '#CC3300', '#E84422', '#E87722', '#E8B822',
    '#D4C87A', '#C8C8C8', '#CCDDFF', '#88AAEE',
    '#77BBFF', '#5599FF', '#4488EE', '#3366DD',
    '#2255CC', '#1144BB'
  ])[
    -- first 7 hex digits of the SHA-256 → 28-bit unsigned int → mod 14.
    -- bit(28) < 2^31, so ::int is non-negative; arrays are 1-based, hence + 1.
    (
      (
        'x' || substr(
          encode(
            extensions.digest(
              p_id::text
                || to_char(p_created_at at time zone 'UTC',
                           'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
              'sha256'
            ),
            'hex'
          ),
          1, 7
        )
      )::bit(28)::int % 14
    ) + 1
  ];
$$;

-- ============================================================================
-- Backfill: assign deterministically to any row missing a color. No-op when the
-- `id` column is absent (fresh replay before the auth stack reconciles the key)
-- or when there are no null rows.
-- ============================================================================
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'id'
  ) then
    update public.user_profiles
    set stellar_color = public.stellar_color_for(id, created_at)
    where stellar_color is null;
  else
    raise notice 'user_profiles.id absent; skipping stellar_color backfill';
  end if;
end $$;

