import "server-only";
import { getOwnerScope } from "@/lib/owner-scope";
import type { SpendingCategory, SpendingRow } from "@/lib/types";

export async function listSpending(options: {
  startDate?: string;
  endDate?: string;
  category?: SpendingCategory;
  limit?: number;
} = {}): Promise<SpendingRow[]> {
  const { supabase, ownerUserId } = await getOwnerScope();
  let query = supabase
    .from("spending")
    .select("id,occurred_date,item,amount,category,time_local,created_at")
    .eq("owner_user_id", ownerUserId)
    .order("occurred_date", { ascending: false })
    .order("time_local", { ascending: false })
    .order("created_at", { ascending: false });
  if (options.startDate) query = query.gte("occurred_date", options.startDate);
  if (options.endDate) query = query.lte("occurred_date", options.endDate);
  if (options.category) query = query.eq("category", options.category);
  if (options.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ ...row, amount: Number(row.amount) })) as SpendingRow[];
}

export async function insertSpending(entry: {
  item: string;
  amount: number;
  category: SpendingCategory;
  date: string;
  time: string;
}): Promise<SpendingRow> {
  const { supabase, ownerUserId } = await getOwnerScope();
  const item = entry.item.trim().slice(0, 200);
  if (!item) throw new Error("Spending item is required.");
  if (!Number.isFinite(entry.amount) || entry.amount <= 0) throw new Error("Spending amount must be greater than zero.");
  const { data, error } = await supabase
    .from("spending")
    .insert({
      owner_user_id: ownerUserId,
      occurred_date: entry.date,
      item,
      amount: entry.amount,
      category: entry.category,
      time_local: entry.time,
    })
    .select("id,occurred_date,item,amount,category,time_local,created_at")
    .single();
  if (error) throw new Error(error.message);
  return { ...data, amount: Number(data.amount) } as SpendingRow;
}

export async function updateSpending(id: string, entry: {
  item: string;
  amount: number;
  category: SpendingCategory;
  date: string;
  time: string;
}): Promise<SpendingRow> {
  const item = entry.item.trim().slice(0, 200);
  if (!item) throw new Error("Spending item is required.");
  if (!Number.isFinite(entry.amount) || entry.amount <= 0) throw new Error("Spending amount must be greater than zero.");
  const { supabase, ownerUserId } = await getOwnerScope();
  const { data, error } = await supabase
    .from("spending")
    .update({
      occurred_date: entry.date,
      item,
      amount: entry.amount,
      category: entry.category,
      time_local: entry.time,
    })
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .select("id,occurred_date,item,amount,category,time_local,created_at")
    .single();
  if (error) throw new Error(error.message);
  return { ...data, amount: Number(data.amount) } as SpendingRow;
}

export async function deleteSpending(id: string): Promise<void> {
  const { supabase, ownerUserId } = await getOwnerScope();
  const { error } = await supabase.from("spending").delete().eq("id", id).eq("owner_user_id", ownerUserId);
  if (error) throw new Error(error.message);
}
