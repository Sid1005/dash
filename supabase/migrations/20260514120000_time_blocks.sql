-- Time blocks for daily schedule. Run in Supabase SQL Editor.

create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  occurred_date date not null,
  start_local text not null
    check (start_local ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_local text not null
    check (end_local ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  activity text not null check (char_length(activity) between 1 and 200),
  category text not null default 'Other'
    check (category in ('Deep Work', 'Admin', 'Meetings', 'Personal', 'Health', 'Learning', 'Other')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (end_local > start_local)
);

create index time_blocks_date_idx
  on public.time_blocks (occurred_date, start_local, created_at);

alter table public.time_blocks enable row level security;

-- No policies: anon/authenticated cannot read/write. Service role bypasses RLS.
