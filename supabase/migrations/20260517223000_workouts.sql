create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  occurred_date date not null,
  text text not null check (char_length(text) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index workouts_date_idx on public.workouts (occurred_date, created_at);

alter table public.workouts enable row level security;
