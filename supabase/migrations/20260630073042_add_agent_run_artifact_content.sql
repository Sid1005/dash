do $$
begin
  if to_regclass('public.agent_runs') is not null then
    alter table public.agent_runs
      add column if not exists md_content text,
      add column if not exists html_content text;
  end if;
end;
$$;
