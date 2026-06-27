alter table public.tickets
  alter column due_at drop not null,
  alter column importance drop not null;

alter table public.tickets
  add column if not exists subtask_details jsonb not null default '{}'::jsonb
  check (jsonb_typeof(subtask_details) = 'object');
