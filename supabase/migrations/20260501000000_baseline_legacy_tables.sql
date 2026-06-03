-- Baseline for tables that pre-existed PHE-5 and were created ad-hoc in the Supabase
-- dashboard before migrations were tracked in git. This migration is a no-op in
-- environments where the tables already exist (every CREATE / ALTER uses IF NOT
-- EXISTS). It exists so a clean local DB can replay every migration in order.
--
-- Scope:
--   * user_profiles  — minimal shape referenced by 20260502120000 and 20260503130500.
--   * waitlist       — shape currently relied on by frontend/components/phenyx/waitlist-modal.tsx.
--
-- Do NOT add new columns here. New columns belong in a later, dated migration.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier    text
);

create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  email      text not null,
  role       text,
  platforms  text[],
  why        text,
  created_at timestamptz not null default now()
);

-- Legacy waitlist had email unique; preserve that for environments where the table
-- is brand new. (In environments where it already exists with the constraint, this
-- is a no-op via IF NOT EXISTS.)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.waitlist'::regclass
      and contype  = 'u'
      and conname  = 'waitlist_email_key'
  ) then
    alter table public.waitlist add constraint waitlist_email_key unique (email);
  end if;
exception
  when duplicate_table then null;
  when duplicate_object then null;
end$$;
