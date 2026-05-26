-- Drop the now-unused free-text column from workouts.
-- All content is stored per-set in workout_exercises.
alter table public.workouts drop column if exists text;
