-- Food log (replaces YAML frontmatter food arrays). Run in Supabase SQL Editor.

create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  logged_date date not null,
  name text not null check (char_length(name) <= 2000),
  calories integer not null default 0 check (calories >= 0 and calories <= 50000),
  protein_g numeric(8, 2) not null default 0 check (protein_g >= 0 and protein_g <= 1000),
  estimated boolean not null default false,
  cost numeric(12, 2) not null default 0 check (cost >= 0),
  time_local text not null default '12:00',
  meal text not null default 'other',
  created_at timestamptz not null default now()
);

create index food_entries_day_idx on public.food_entries (logged_date);
create index food_entries_day_time_idx on public.food_entries (logged_date, time_local);

alter table public.food_entries enable row level security;
