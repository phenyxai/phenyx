-- PHE-125: onboarding adds the discover explainer between the polaris intro and
-- the Onairos connect screen, persisted as its own funnel step.
--
-- Standalone file on purpose: Postgres refuses to use an enum value added by
-- ADD VALUE inside the transaction that added it, and each migration runs in
-- its own transaction, so nothing else may share this file. IF NOT EXISTS
-- keeps it replay-safe. Enum values cannot be dropped, so there is no down.
alter type onboarding_step add value if not exists 'discover_intro' after 'polaris_intro';
