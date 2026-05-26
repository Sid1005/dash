-- Active problems tracking table. Run in Supabase SQL Editor.

create table public.problems (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 2000),
  solved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index problems_solved_created_idx
  on public.problems (solved, created_at);

alter table public.problems enable row level security;

-- No policies: anon/authenticated cannot read/write. Service role bypasses RLS.
