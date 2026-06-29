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
