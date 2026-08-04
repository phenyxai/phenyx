-- Finalize PHE-51 observation invariants in a separate transaction. The main
-- migration backfills these columns; separating this ALTER TABLE avoids
-- PostgreSQL SQLSTATE 55006 from its deferred foreign-key trigger events.
alter table public.observations
  alter column area_id set not null,
  alter column generation_run_id set not null,
  alter column schema_version set not null,
  alter column points set not null,
  alter column record_count set not null,
  alter column sources set not null,
  alter column prompt_version set not null,
  alter column model_version set not null;
