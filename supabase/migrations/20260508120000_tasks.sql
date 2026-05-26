-- Run in Supabase SQL Editor once (or via supabase db push).
-- Browser uses /api/tasks only; server uses service_role / secret key (bypasses RLS).

create extension if not exists "pgcrypto";

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) <= 2000),
  due_at timestamptz not null,
  done boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_due_at_idx on public.tasks (due_at);
create index tasks_open_due_idx on public.tasks (due_at) where not done;

alter table public.tasks enable row level security;

-- No policies: anon/authenticated cannot read/write. Service role bypasses RLS.

create or replace function public.set_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row
  execute function public.set_tasks_updated_at();
