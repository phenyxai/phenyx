-- PHE-35 DOWN: Revert 20260701000000_phe35_events_engagement_instrumentation.sql
-- Idempotent (safe to re-run).
--
-- Scope: this down only removes what the PHE-35 forward migration UNIQUELY adds —
-- the composite (event_type, occurred_at desc) index. The `events` table itself,
-- its (user_id, occurred_at desc) index, RLS, and append-only trigger are owned
-- by PHE-31 (20260625120000_phe31_observation_polaris_model.sql) and are dropped
-- by that migration's down, not here — so reverting PHE-35 never removes a table
-- another migration still depends on.

drop index if exists public.events_type_time_idx;
