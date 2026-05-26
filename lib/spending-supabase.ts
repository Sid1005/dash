import { createAdminClient } from "./supabase/admin";

export interface SpendingRow {
  id: string;
  occurred_date: string;
  item: string;
  amount: number;
  category: string;
  time_local: string;
}

export async function listSpendingForDate(date: string): Promise<SpendingRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("spending")
    .select("id, occurred_date, item, amount, category, time_local")
    .eq("occurred_date", date)
    .order("time_local")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as SpendingRow[];
}

export async function insertSpending(
  date: string,
  entry: { item: string; amount: number; category: string; time: string }
): Promise<SpendingRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("spending")
    .insert({
      occurred_date: date,
      item: entry.item,
      amount: entry.amount,
      category: entry.category,
      time_local: entry.time ?? "00:00",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as SpendingRow;
}

export async function deleteSpending(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("spending").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
