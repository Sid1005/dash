create table if not exists public.agent_runs (
  id uuid primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  agent text not null check (agent in ('codex', 'claude', 'hermes', 'openclaw', 'ideas')),
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  input_prompt text not null default '',
  generated_prompt text not null default '',
  artifact_dir text not null default '',
  md_path text,
  html_path text,
  md_content text,
  html_content text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_runs_owner_created_idx on public.agent_runs (owner_user_id, created_at desc);
create index if not exists agent_runs_owner_ticket_idx on public.agent_runs (owner_user_id, ticket_id, created_at desc);
create index if not exists agent_runs_owner_status_idx on public.agent_runs (owner_user_id, status, created_at desc);

alter table public.agent_runs enable row level security;
grant select, insert, update, delete on public.agent_runs to authenticated;

drop policy if exists "Users can read own agent runs" on public.agent_runs;
drop policy if exists "Users can insert own agent runs" on public.agent_runs;
drop policy if exists "Users can update own agent runs" on public.agent_runs;
drop policy if exists "Users can delete own agent runs" on public.agent_runs;
create policy "Users can read own agent runs" on public.agent_runs for select to authenticated using (owner_user_id = auth.uid());
create policy "Users can insert own agent runs" on public.agent_runs for insert to authenticated with check (owner_user_id = auth.uid());
create policy "Users can update own agent runs" on public.agent_runs for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Users can delete own agent runs" on public.agent_runs for delete to authenticated using (owner_user_id = auth.uid());

create or replace function public.set_agent_runs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_runs_set_updated_at on public.agent_runs;
create trigger agent_runs_set_updated_at
  before update on public.agent_runs
  for each row
  execute function public.set_agent_runs_updated_at();

create or replace function public.claim_next_agent_run()
returns setof public.agent_runs
language plpgsql
as $$
begin
  return query
    update public.agent_runs
      set status = 'running',
          started_at = now()
    where id = (
      select id
      from public.agent_runs
      where status = 'queued'
      order by created_at asc
      for update skip locked
      limit 1
    )
      and status = 'queued'
    returning public.agent_runs.*;
end;
$$;
