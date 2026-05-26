import { createAdminClient } from "@/lib/supabase/admin";
import type { FoodEntry } from "@/lib/types";

export type FoodEntryWithId = FoodEntry & { id: string };

type FoodRow = {
  id: string;
  logged_date: string;
  name: string;
  calories: number;
  protein_g: number | string;
  estimated: boolean;
  cost: number | string;
  time_local: string;
  meal: string;
};

function rowToEntry(row: FoodRow): FoodEntryWithId {
  const pg =
    typeof row.protein_g === "string" ? parseFloat(row.protein_g) : row.protein_g;
  const cost = typeof row.cost === "string" ? parseFloat(row.cost) : row.cost;
  return {
    id: row.id,
    name: row.name,
    calories: row.calories,
    protein_g: Number.isFinite(pg) ? Math.round(pg * 10) / 10 : 0,
    estimated: row.estimated,
    cost: Number.isFinite(cost) ? cost : 0,
    time: row.time_local,
    meal: row.meal || "other",
  };
}

export async function listFoodEntriesForDate(loggedDate: string): Promise<FoodEntryWithId[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("food_entries")
    .select("*")
    .eq("logged_date", loggedDate)
    .order("time_local", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as FoodRow[]).map(rowToEntry);
}

export async function insertFoodEntry(
  loggedDate: string,
  entry: FoodEntry
): Promise<FoodEntryWithId> {
  const supabase = createAdminClient();
  const payload = {
    logged_date: loggedDate,
    name: entry.name.trim(),
    calories: Math.max(0, Math.round(entry.calories ?? 0)),
    protein_g: Math.max(0, Number(entry.protein_g ?? 0)),
    estimated: Boolean(entry.estimated),
    cost: Math.max(0, Number(entry.cost ?? 0)),
    time_local: entry.time || "12:00",
    meal: entry.meal || "other",
  };

  const { data, error } = await supabase
    .from("food_entries")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return rowToEntry(data as FoodRow);
}

export async function deleteFoodEntry(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("food_entries").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
