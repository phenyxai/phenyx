-- PHE-13 DOWN: revert 20260604160000_user_profiles_stellar_color_backfill.sql
-- The backfilled colors are deterministic and immutable account identity, so we
-- intentionally do NOT null them back out (that would lose nothing recomputable
-- but would needlessly churn live identity). We only drop the helper function
-- introduced by the up migration; pgcrypto is left in place as other code may use
-- it. The function is dropped only if no live default still depends on it.
drop function if exists public.stellar_color_for(uuid, timestamptz);
