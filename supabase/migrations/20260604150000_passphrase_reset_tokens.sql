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
