-- One row per set within a workout exercise
create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_name text not null check (char_length(exercise_name) between 1 and 200),
  set_number int not null default 1,    -- 1, 2, 3 …
  reps int not null default 0,
  weight_kg numeric(6, 2) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index workout_exercises_workout_idx on public.workout_exercises (workout_id, set_number);
create index workout_exercises_name_idx   on public.workout_exercises (exercise_name);

alter table public.workout_exercises enable row level security;
-- No policies — service role only.
