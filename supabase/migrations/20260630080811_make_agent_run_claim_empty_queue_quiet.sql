drop function if exists public.claim_next_agent_run();

create function public.claim_next_agent_run()
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
