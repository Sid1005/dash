-- Add per-user ownership and RLS policies for dashboard content.

do $$
declare
  owner_id uuid;
  table_name text;
  tables text[] := array[
    'tasks',
    'food_entries',
    'activities',
    'time_blocks',
    'spending',
    'learnings',
    'workouts',
    'workout_exercises',
    'problems',
    'ideas',
    'quotes'
  ];
begin
  select id into owner_id
  from auth.users
  where email = 'siddharth.ceri@gmail.com'
  limit 1;

  if owner_id is null then
    raise exception 'Default owner user not found: siddharth.ceri@gmail.com';
  end if;

  foreach table_name in array tables loop
    execute format(
      'alter table public.%I add column if not exists owner_user_id uuid references auth.users(id) on delete cascade',
      table_name
    );

    execute format(
      'update public.%I set owner_user_id = $1 where owner_user_id is null',
      table_name
    ) using owner_id;

    execute format(
      'alter table public.%I alter column owner_user_id set not null',
      table_name
    );

    execute format('alter table public.%I enable row level security', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end $$;

create index if not exists tasks_owner_due_idx on public.tasks (owner_user_id, due_at);
create index if not exists food_entries_owner_day_time_idx on public.food_entries (owner_user_id, logged_date, time_local, created_at);
create index if not exists activities_owner_date_time_idx on public.activities (owner_user_id, occurred_date, time_local, created_at);
create index if not exists time_blocks_owner_date_idx on public.time_blocks (owner_user_id, occurred_date, start_local, created_at);
create index if not exists spending_owner_date_idx on public.spending (owner_user_id, occurred_date, time_local, created_at);
create index if not exists learnings_owner_date_idx on public.learnings (owner_user_id, occurred_date, created_at);
create index if not exists workouts_owner_date_idx on public.workouts (owner_user_id, occurred_date, created_at);
create index if not exists workout_exercises_owner_workout_idx on public.workout_exercises (owner_user_id, workout_id, set_number);
create index if not exists problems_owner_solved_idx on public.problems (owner_user_id, solved, created_at);
create index if not exists ideas_owner_archived_idx on public.ideas (owner_user_id, archived, created_at);
create index if not exists quotes_owner_created_idx on public.quotes (owner_user_id, created_at desc);

drop policy if exists "Users can read own tasks" on public.tasks;
drop policy if exists "Users can insert own tasks" on public.tasks;
drop policy if exists "Users can update own tasks" on public.tasks;
drop policy if exists "Users can delete own tasks" on public.tasks;
create policy "Users can read own tasks" on public.tasks for select to authenticated using (owner_user_id = auth.uid());
create policy "Users can insert own tasks" on public.tasks for insert to authenticated with check (owner_user_id = auth.uid());
create policy "Users can update own tasks" on public.tasks for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Users can delete own tasks" on public.tasks for delete to authenticated using (owner_user_id = auth.uid());

drop policy if exists "Users can read own food entries" on public.food_entries;
drop policy if exists "Users can insert own food entries" on public.food_entries;
drop policy if exists "Users can update own food entries" on public.food_entries;
drop policy if exists "Users can delete own food entries" on public.food_entries;
create policy "Users can read own food entries" on public.food_entries for select to authenticated using (owner_user_id = auth.uid());
create policy "Users can insert own food entries" on public.food_entries for insert to authenticated with check (owner_user_id = auth.uid());
create policy "Users can update own food entries" on public.food_entries for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Users can delete own food entries" on public.food_entries for delete to authenticated using (owner_user_id = auth.uid());

drop policy if exists "Users can read own activities" on public.activities;
drop policy if exists "Users can insert own activities" on public.activities;
drop policy if exists "Users can update own activities" on public.activities;
drop policy if exists "Users can delete own activities" on public.activities;
create policy "Users can read own activities" on public.activities for select to authenticated using (owner_user_id = auth.uid());
create policy "Users can insert own activities" on public.activities for insert to authenticated with check (owner_user_id = auth.uid());
create policy "Users can update own activities" on public.activities for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Users can delete own activities" on public.activities for delete to authenticated using (owner_user_id = auth.uid());

drop policy if exists "Users can read own time blocks" on public.time_blocks;
drop policy if exists "Users can insert own time blocks" on public.time_blocks;
drop policy if exists "Users can update own time blocks" on public.time_blocks;
drop policy if exists "Users can delete own time blocks" on public.time_blocks;
create policy "Users can read own time blocks" on public.time_blocks for select to authenticated using (owner_user_id = auth.uid());
create policy "Users can insert own time blocks" on public.time_blocks for insert to authenticated with check (owner_user_id = auth.uid());
create policy "Users can update own time blocks" on public.time_blocks for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Users can delete own time blocks" on public.time_blocks for delete to authenticated using (owner_user_id = auth.uid());

drop policy if exists "Users can read own spending" on public.spending;
drop policy if exists "Users can insert own spending" on public.spending;
drop policy if exists "Users can update own spending" on public.spending;
drop policy if exists "Users can delete own spending" on public.spending;
create policy "Users can read own spending" on public.spending for select to authenticated using (owner_user_id = auth.uid());
create policy "Users can insert own spending" on public.spending for insert to authenticated with check (owner_user_id = auth.uid());
create policy "Users can update own spending" on public.spending for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Users can delete own spending" on public.spending for delete to authenticated using (owner_user_id = auth.uid());

drop policy if exists "Users can read own learnings" on public.learnings;
drop policy if exists "Users can insert own learnings" on public.learnings;
drop policy if exists "Users can update own learnings" on public.learnings;
drop policy if exists "Users can delete own learnings" on public.learnings;
create policy "Users can read own learnings" on public.learnings for select to authenticated using (owner_user_id = auth.uid());
create policy "Users can insert own learnings" on public.learnings for insert to authenticated with check (owner_user_id = auth.uid());
create policy "Users can update own learnings" on public.learnings for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Users can delete own learnings" on public.learnings for delete to authenticated using (owner_user_id = auth.uid());

drop policy if exists "Users can read own workouts" on public.workouts;
drop policy if exists "Users can insert own workouts" on public.workouts;
drop policy if exists "Users can update own workouts" on public.workouts;
drop policy if exists "Users can delete own workouts" on public.workouts;
create policy "Users can read own workouts" on public.workouts for select to authenticated using (owner_user_id = auth.uid());
create policy "Users can insert own workouts" on public.workouts for insert to authenticated with check (owner_user_id = auth.uid());
create policy "Users can update own workouts" on public.workouts for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Users can delete own workouts" on public.workouts for delete to authenticated using (owner_user_id = auth.uid());

drop policy if exists "Users can read own workout exercises" on public.workout_exercises;
drop policy if exists "Users can insert own workout exercises" on public.workout_exercises;
drop policy if exists "Users can update own workout exercises" on public.workout_exercises;
drop policy if exists "Users can delete own workout exercises" on public.workout_exercises;
create policy "Users can read own workout exercises" on public.workout_exercises for select to authenticated using (owner_user_id = auth.uid());
create policy "Users can insert own workout exercises" on public.workout_exercises for insert to authenticated with check (owner_user_id = auth.uid());
create policy "Users can update own workout exercises" on public.workout_exercises for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Users can delete own workout exercises" on public.workout_exercises for delete to authenticated using (owner_user_id = auth.uid());

drop policy if exists "Users can read own problems" on public.problems;
drop policy if exists "Users can insert own problems" on public.problems;
drop policy if exists "Users can update own problems" on public.problems;
drop policy if exists "Users can delete own problems" on public.problems;
create policy "Users can read own problems" on public.problems for select to authenticated using (owner_user_id = auth.uid());
create policy "Users can insert own problems" on public.problems for insert to authenticated with check (owner_user_id = auth.uid());
create policy "Users can update own problems" on public.problems for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Users can delete own problems" on public.problems for delete to authenticated using (owner_user_id = auth.uid());

drop policy if exists "Users can read own ideas" on public.ideas;
drop policy if exists "Users can insert own ideas" on public.ideas;
drop policy if exists "Users can update own ideas" on public.ideas;
drop policy if exists "Users can delete own ideas" on public.ideas;
create policy "Users can read own ideas" on public.ideas for select to authenticated using (owner_user_id = auth.uid());
create policy "Users can insert own ideas" on public.ideas for insert to authenticated with check (owner_user_id = auth.uid());
create policy "Users can update own ideas" on public.ideas for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Users can delete own ideas" on public.ideas for delete to authenticated using (owner_user_id = auth.uid());

drop policy if exists "Users can read own quotes" on public.quotes;
drop policy if exists "Users can insert own quotes" on public.quotes;
drop policy if exists "Users can update own quotes" on public.quotes;
drop policy if exists "Users can delete own quotes" on public.quotes;
create policy "Users can read own quotes" on public.quotes for select to authenticated using (owner_user_id = auth.uid());
create policy "Users can insert own quotes" on public.quotes for insert to authenticated with check (owner_user_id = auth.uid());
create policy "Users can update own quotes" on public.quotes for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy "Users can delete own quotes" on public.quotes for delete to authenticated using (owner_user_id = auth.uid());
