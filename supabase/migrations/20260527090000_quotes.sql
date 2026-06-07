-- Quotes and thoughts to remember. Run in Supabase SQL Editor or via CLI.

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 2000),
  author text check (char_length(author) <= 255),
  created_at timestamptz not null default now()
);

create index quotes_created_at_idx on public.quotes (created_at desc);

alter table public.quotes enable row level security;
