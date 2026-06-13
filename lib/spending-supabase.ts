import { type DbScope, resolveDbScope } from "./owner-scope";

export interface SpendingRow {
  id: string;
  occurred_date: string;
  item: string;
  amount: number;
  category: string;
  time_local: string;
}

export async function listSpendingForDate(date: string, scope?: DbScope): Promise<SpendingRow[]> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const { data, error } = await supabase
    .from("spending")
    .select("id, occurred_date, item, amount, category, time_local")
    .eq("owner_user_id", ownerUserId)
    .eq("occurred_date", date)
    .order("time_local")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as SpendingRow[];
}

export async function insertSpending(
  date: string,
  entry: { item: string; amount: number; category: string; time: string },
  scope?: DbScope
): Promise<SpendingRow> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const { data, error } = await supabase
    .from("spending")
    .insert({
      owner_user_id: ownerUserId,
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

export async function deleteSpending(id: string, scope?: DbScope): Promise<void> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const { error } = await supabase.from("spending").delete().eq("id", id).eq("owner_user_id", ownerUserId);
  if (error) throw new Error(error.message);
}
