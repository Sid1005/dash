-- Life's work sections (vision, goals, etc.). Run in Supabase SQL Editor.

create table public.lifeswork (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  unique (section)
);

alter table public.lifeswork enable row level security;

-- No policies: anon/authenticated cannot read/write. Service role bypasses RLS.
