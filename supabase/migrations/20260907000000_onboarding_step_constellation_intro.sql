-- PHE-90: v244 onboarding adds the constellation explainer (4C) between the
-- intro (manifesto) and the polaris intro, persisted as its own funnel step.
--
-- Standalone file on purpose: Postgres refuses to use an enum value added by
-- ADD VALUE inside the transaction that added it, and each migration runs in
-- its own transaction, so nothing else may share this file. IF NOT EXISTS
-- keeps it replay-safe. Enum values cannot be dropped, so there is no down.
alter type onboarding_step add value if not exists 'constellation_intro' before 'polaris_intro';
