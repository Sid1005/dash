-- Store a meal-level display title for combined food logs.

alter table public.food_entries
  add column if not exists meal_title text;

create index if not exists food_entries_meal_title_idx
  on public.food_entries (meal_title);
