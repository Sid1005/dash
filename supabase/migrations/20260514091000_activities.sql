-- Activity stream for user notes and agent/system events. Run in Supabase SQL Editor.

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  occurred_date date not null,
  time_local text not null default '12:00'
    check (time_local ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  actor text not null default 'telegram'
    check (actor in ('telegram', 'agent', 'calendar', 'system', 'user')),
  kind text not null default 'note'
    check (kind in ('note', 'activity', 'agent_event')),
  verb text not null default 'noted' check (char_length(verb) <= 80),
  body text not null check (char_length(body) <= 4000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activities_date_time_idx on public.activities (occurred_date, time_local, created_at);
create index activities_actor_date_idx on public.activities (actor, occurred_date);

alter table public.activities enable row level security;

-- No policies: anon/authenticated cannot read/write. Service role bypasses RLS.
