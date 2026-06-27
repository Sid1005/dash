alter table public.workouts
  add column if not exists title text not null default 'Workout Session'
  check (char_length(title) between 1 and 120);

create index if not exists workouts_owner_title_idx on public.workouts (owner_user_id, lower(title));
