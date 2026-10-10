-- PHE-98 DOWN: revert 20261009120000_phe98_stellar_palette_remap.sql
-- Restores the 14-color stellar_color_for from
-- 20260604160000_user_profiles_stellar_color_backfill.sql and recomputes every
-- row with it. Inputs are immutable, so each account gets back exactly the color
-- it had before the remap (rows that were null before the remap come back
-- colored, the same as a fresh backfill would leave them).

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
