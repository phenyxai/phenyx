-- Reverse: rename `id` back to `user_id`.
-- ⚠️ This re-introduces the legacy drift and is intended ONLY for local
-- migration-replay rollback. Never run against staging/prod, where `id` is the
-- canonical, app-relied-upon column.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'user_id'
  ) then
    alter table public.user_profiles rename column id to user_id;
  end if;
end
$$;
