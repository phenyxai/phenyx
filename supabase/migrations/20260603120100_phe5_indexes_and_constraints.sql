-- PHE-5: Indexes and constraints for constellation tables and waitlist.
-- Idempotency: CREATE INDEX IF NOT EXISTS + DO block guard for waitlist unique index.
-- See down migration: supabase/migrations/down/20260603120100_phe5_indexes_and_constraints_down.sql

-- constellation_points lookups: most recent points per user, and per (user, pillar)
create index if not exists constellation_points_user_created_idx
  on public.constellation_points (user_id, created_at desc);

create index if not exists constellation_points_user_pillar_idx
  on public.constellation_points (user_id, pillar);

-- Case-insensitive unique index on waitlist email.
-- Skip if ANY unique index/constraint already covers `email` or `lower(email)`,
-- including the legacy `waitlist_email_key` UNIQUE(email) constraint from the
-- baseline migration. Two unique indexes on the same logical key would double
-- the surface area to reason about on duplicate-key errors.
do $$
declare
  covering_count int;
begin
  select count(*) into covering_count
  from pg_index i
  join pg_class c on c.oid = i.indrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'waitlist'
    and i.indisunique
    and (
      -- plain UNIQUE(email): single key column whose attname is 'email'
      (
        i.indnatts = 1
        and exists (
          select 1 from pg_attribute a
          where a.attrelid = i.indrelid
            and a.attnum = i.indkey[0]
            and a.attname = 'email'
        )
      )
      -- functional UNIQUE(lower(email)): expression index referencing 'email'
      or (
        pg_get_indexdef(i.indexrelid) ilike '%lower(email)%'
      )
    );

  if covering_count = 0 then
    create unique index waitlist_email_unique_idx
      on public.waitlist (lower(email));
  end if;
end $$;

-- Note: constellation_state(user_id) UNIQUE is already enforced by the primary key.
