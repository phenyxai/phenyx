-- PHE-98: brand blue is reserved for PHENYX — take it out of the accent pool.
-- Purpose: #5599FF belongs to the brand and the sign-in / create-account buttons
--          and is never a person's accent. This migration
--            1. redefines public.stellar_color_for over the 13-color palette
--               without it (mod 13), mirroring STELLAR in
--               backend/src/common/stellar.util.ts and frontend/lib/stellar.ts;
--            2. reassigns everyone who already holds it, re-hashing their
--               (id, created_at) into the new palette;
--            3. adds a check constraint so no row can hold it again.
-- Immutability: stellar_color is guarded by user_profiles_stellar_color_immutable
--          (PHE-31). Step 2 disables that one trigger for its UPDATE alone and
--          re-enables it straight after, inside this migration's transaction.
-- Idempotency: the function uses CREATE OR REPLACE, the UPDATE only matches rows
--          still holding brand blue, and the constraint is dropped before it is
--          added, so a re-run is a clean no-op.
-- See down migration: supabase/migrations/down/20261008120000_phe98_reserve_brand_blue_down.sql

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
    '#77BBFF', '#4488EE', '#3366DD', '#2255CC',
    '#1144BB'
  ])[
    -- first 7 hex digits of the SHA-256 → 28-bit unsigned int → mod 13.
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
      )::bit(28)::int % 13
    ) + 1
  ];
$$;

alter table public.user_profiles disable trigger user_profiles_stellar_color_immutable;

update public.user_profiles
set stellar_color = public.stellar_color_for(id, created_at)
where upper(stellar_color) = '#5599FF';

alter table public.user_profiles enable trigger user_profiles_stellar_color_immutable;

alter table public.user_profiles
  drop constraint if exists user_profiles_stellar_color_not_brand_blue;
alter table public.user_profiles
  add constraint user_profiles_stellar_color_not_brand_blue
  check (stellar_color is null or upper(stellar_color) <> '#5599FF');
