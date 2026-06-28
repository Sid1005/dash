alter table public.tickets
  drop constraint if exists tickets_importance_check;

update public.tickets
set importance = case importance
  when 'urgent' then 'p0'
  when 'high' then 'p1'
  when 'medium' then 'p2'
  when 'low' then 'p2'
  else importance
end
where importance in ('urgent', 'high', 'medium', 'low');

alter table public.tickets
  add constraint tickets_importance_check check (importance in ('p0', 'p1', 'p2'));
