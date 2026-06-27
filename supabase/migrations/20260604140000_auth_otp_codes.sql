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
