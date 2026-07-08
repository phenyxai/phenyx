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
-- Runs after the phe5 tables/triggers (20260603120200) and before the phe5 RLS
-- policies (20260603120300), so the policies — and the whole auth chain after
-- them — operate on `id` on every environment.
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
