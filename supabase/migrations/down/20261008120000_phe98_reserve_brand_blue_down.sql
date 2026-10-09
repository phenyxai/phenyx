-- PHE-98 DOWN: revert 20261008120000_phe98_reserve_brand_blue.sql
-- Drops the brand-blue check constraint and restores the 14-color
-- stellar_color_for from PHE-13. Reassigned colors stay as they are: they are
-- the people's accents now, and moving them back onto brand blue would undo the
-- point of the change and churn live identity a second time.

alter table public.user_profiles
  drop constraint if exists user_profiles_stellar_color_not_brand_blue;

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
