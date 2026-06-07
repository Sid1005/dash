-- Remove Life's Work and add Ideas table
drop table if exists public.lifeswork;

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 2000),
  category text not null default 'General',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for querying active/archived ideas
create index ideas_archived_created_idx on public.ideas (archived, created_at);

-- Enable RLS
alter table public.ideas enable row level security;
