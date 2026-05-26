-- Learning notes per day. Run in Supabase SQL Editor.

create table public.learnings (
  id uuid primary key default gen_random_uuid(),
  occurred_date date not null,
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index learnings_date_idx
  on public.learnings (occurred_date, created_at);

alter table public.learnings enable row level security;

-- No policies: anon/authenticated cannot read/write. Service role bypasses RLS.
