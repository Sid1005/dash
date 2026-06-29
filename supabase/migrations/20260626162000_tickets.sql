create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  title text not null check (char_length(title) <= 2000),
  due_at timestamptz not null,
  due_label text not null default '',
  horizon text not null check (horizon in ('today', 'next_3_days', 'this_week', 'this_month')),
  importance text not null check (importance in ('low', 'medium', 'high', 'urgent')),
  subtasks jsonb not null default '[]'::jsonb check (jsonb_typeof(subtasks) = 'array'),
  agent text check (agent in ('codex', 'claude', 'hermes', 'openclaw', 'ideas')),
  source_text text not null default '',
  status text not null default 'backlog' check (status in ('backlog', 'now', 'done', 'archived')),
  sort_order integer not null default 0,
  mission_status text not null default 'none' check (mission_status in ('none', 'queued', 'created', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tickets_owner_due_idx on public.tickets (owner_user_id, due_at);
create index if not exists tickets_owner_agent_idx on public.tickets (owner_user_id, agent, created_at desc);
create index if not exists tickets_owner_status_sort_idx on public.tickets (owner_user_id, status, sort_order, created_at desc);
create index if not exists tickets_owner_created_idx on public.tickets (owner_user_id, created_at desc);

alter table public.tickets enable row level security;
grant select, insert, update, delete on public.tickets to authenticated;

drop policy if exists "Users can read own tickets" on public.tickets;
drop policy if exists "Users can insert own tickets" on public.tickets;
drop policy if exists "Users can update own tickets" on public.tickets;
drop policy if exists "Users can delete own tickets" on public.tickets;
create policy "Users can read own tickets" on public.tickets for select to authenticated using (owner_user_id = auth.uid());
create policy "Users can insert own tickets" on public.tickets for insert to authenticated with check (owner_user_id = auth.uid());
create policy "Users can update own tickets" on public.tickets for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Users can delete own tickets" on public.tickets for delete to authenticated using (owner_user_id = auth.uid());

create or replace function public.set_tickets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tickets_set_updated_at on public.tickets;
create trigger tickets_set_updated_at
  before update on public.tickets
  for each row
  execute function public.set_tickets_updated_at();
