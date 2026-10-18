alter table public.polaris_conversations
  drop constraint if exists polaris_conversations_mode_check,
  drop column if exists context,
  drop column if exists mode;
