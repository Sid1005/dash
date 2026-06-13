-- Google Calendar events synced into Dash.

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'google' check (provider in ('google')),
  calendar_id text not null default 'primary',
  external_event_id text not null,
  title text not null check (char_length(title) between 1 and 500),
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  start_date date not null,
  end_date date not null,
  all_day boolean not null default false,
  raw_event jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  check (end_date >= start_date),
  unique (owner_user_id, provider, calendar_id, external_event_id)
);

create index if not exists calendar_events_owner_date_idx
  on public.calendar_events (owner_user_id, start_date, end_date, start_at);

create index if not exists calendar_events_owner_start_idx
  on public.calendar_events (owner_user_id, start_at, end_at);

alter table public.calendar_events enable row level security;

grant select, insert, update, delete on public.calendar_events to authenticated;
grant select, insert, update, delete on public.calendar_events to service_role;

drop policy if exists "Users can read own calendar events" on public.calendar_events;
drop policy if exists "Users can insert own calendar events" on public.calendar_events;
drop policy if exists "Users can update own calendar events" on public.calendar_events;
drop policy if exists "Users can delete own calendar events" on public.calendar_events;

create policy "Users can read own calendar events"
  on public.calendar_events
  for select
  to authenticated
  using (owner_user_id = auth.uid());

create policy "Users can insert own calendar events"
  on public.calendar_events
  for insert
  to authenticated
  with check (owner_user_id = auth.uid());

create policy "Users can update own calendar events"
  on public.calendar_events
  for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy "Users can delete own calendar events"
  on public.calendar_events
  for delete
  to authenticated
  using (owner_user_id = auth.uid());
