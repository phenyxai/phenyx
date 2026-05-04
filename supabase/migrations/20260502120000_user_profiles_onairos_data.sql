-- Run via Supabase CLI or SQL Editor: stores latest Onairos completion payload (no token) per user.
alter table public.user_profiles
  add column if not exists onairos_data jsonb;

comment on column public.user_profiles.onairos_data is 'Redacted Onairos completion snapshot (token omitted) for personalization.';
