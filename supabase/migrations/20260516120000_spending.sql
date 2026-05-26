-- Spending entries. Run in Supabase SQL Editor.

create table public.spending (
  id uuid primary key default gen_random_uuid(),
  occurred_date date not null,
  item text not null check (char_length(item) between 1 and 200),
  amount numeric(10, 2) not null check (amount >= 0),
  category text not null default 'Other'
    check (category in ('Food', 'Transport', 'Health', 'Entertainment', 'Shopping', 'Other')),
  time_local text not null default '00:00'
    check (time_local ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  created_at timestamptz not null default now()
);

create index spending_date_idx
  on public.spending (occurred_date, time_local, created_at);

alter table public.spending enable row level security;

-- No policies: anon/authenticated cannot read/write. Service role bypasses RLS.
