-- PHE-98: replace the 14-color stellar palette with the demo's 24 and remap
--          every existing account onto it.
-- Purpose: brand blue (#B9D5FF and its shades) belongs to PHENYX alone and is
--          never a person's color (doc 7). Eight of the old fourteen colors were
--          blues close to it, so the palette is replaced with 24 non-blue colors
--          (four each of rose, violet, verdant, tide, gold, ember) and every row
--          is reassigned with the same deterministic hash.
-- Determinism: unchanged from 20260604160000_user_profiles_stellar_color_backfill
--          except the palette and its length. SHA-256 of (id::text ||
--          to_char(created_at @ UTC, ISO-8601 ms 'Z')), first 7 hex digits read
--          as a 28-bit unsigned int, mod 24. Mirrors stellarColorFor() in
--          backend/src/common/stellar.util.ts and STELLAR in
--          frontend/lib/stellar.ts; frontend/lib/stellar.test.ts parses this
--          file and fails if the three diverge.
-- Immutability: stellar_color is guarded by user_profiles_stellar_color_immutable
--          (PHE-31). This one-off remap disables that trigger for the UPDATE
--          and re-enables it straight after, inside the migration transaction.
-- Idempotency: CREATE OR REPLACE for the function; the UPDATE recomputes from
--          immutable inputs, so a re-run assigns the same colors again.
-- See down migration: supabase/migrations/down/20261009130000_phe98_stellar_palette_remap_down.sql

create extension if not exists pgcrypto with schema extensions;

-- ============================================================================
-- public.stellar_color_for(id, created_at) — the canonical (id, created_at) →
-- palette-hex mapping. IMMUTABLE: identical inputs always yield the same hex.
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
    '#DE9AAE', '#E4B4C4', '#D77C99', '#CB7085',
    '#B59BE3', '#C6B2EB', '#AC87D5', '#CD95D8',
    '#77C5A5', '#9ABC8F', '#B3C0A0', '#9FAB68',
    '#8CD1C2', '#68BEB0', '#65ADB1', '#9CC9C2',
    '#DCC697', '#D9B36D', '#E9A65B', '#E2DBC6',
    '#E5B391', '#D89677', '#E59894', '#D88475'
  ])[
    -- first 7 hex digits of the SHA-256 → 28-bit unsigned int → mod 24.
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
      )::bit(28)::int % 24
    ) + 1
  ];
$$;

-- ============================================================================
-- Remap: every row, including any still null. Guarded like the original
-- backfill so a fresh replay without the `id` column is a no-op.
-- ============================================================================
do $$
declare
  v_guarded boolean;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'id'
  ) then
    raise notice 'user_profiles.id absent; skipping stellar_color remap';
    return;
  end if;

  select exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.user_profiles'::regclass
      and tgname = 'user_profiles_stellar_color_immutable'
  ) into v_guarded;

  if v_guarded then
    alter table public.user_profiles disable trigger user_profiles_stellar_color_immutable;
  end if;

  update public.user_profiles
  set stellar_color = public.stellar_color_for(id, created_at);

  if v_guarded then
    alter table public.user_profiles enable trigger user_profiles_stellar_color_immutable;
  end if;
end $$;
