alter table public.tickets
  add column if not exists status text not null default 'backlog' check (status in ('backlog', 'now', 'done', 'archived')),
  add column if not exists sort_order integer not null default 0;

create index if not exists tickets_owner_status_sort_idx on public.tickets (owner_user_id, status, sort_order, created_at desc);
