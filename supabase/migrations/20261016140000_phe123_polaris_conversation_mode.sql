-- PHE-123: polaris conversations run in one of three modes (spec doc 4) and may
-- open from a moment or a discovery. The mode is fixed when the conversation is
-- created; the opening context is encrypted at rest like the messages.
-- See down migration: supabase/migrations/down/20261016140000_phe123_polaris_conversation_mode_down.sql

alter table public.polaris_conversations
  add column if not exists mode text,
  add column if not exists context text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'polaris_conversations_mode_check'
  ) then
    alter table public.polaris_conversations
      add constraint polaris_conversations_mode_check
      check (mode is null or mode in ('clarify', 'understand', 'decide'));
  end if;
end $$;

comment on column public.polaris_conversations.mode is
  'PHE-123: clarify, understand or decide. Null on conversations from before modes.';
comment on column public.polaris_conversations.context is
  'PHE-123: encrypted text of the moment or discovery the conversation opened from.';
