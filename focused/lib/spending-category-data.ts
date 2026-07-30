import "server-only";
import { getOwnerScope } from "@/lib/owner-scope";
import { cleanSpendingCategory, findSpendingCategory } from "@/lib/spending-categories";
import type { SpendingCategoryRow } from "@/lib/types";

const CATEGORY_SELECT = "id,name,created_at";

export async function listSpendingCategories(): Promise<SpendingCategoryRow[]> {
  const { supabase, ownerUserId } = await getOwnerScope();
  const { data, error } = await supabase
    .from("spending_categories")
    .select(CATEGORY_SELECT)
    .eq("owner_user_id", ownerUserId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SpendingCategoryRow[];
}

export async function createSpendingCategory(value: unknown): Promise<SpendingCategoryRow> {
  const name = cleanSpendingCategory(value);
  if (!name) throw new Error("Category name is required.");
  const { supabase, ownerUserId } = await getOwnerScope();
  const { data, error } = await supabase
    .from("spending_categories")
    .insert({ owner_user_id: ownerUserId, name })
    .select(CATEGORY_SELECT)
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("That category already exists.");
    throw new Error(error.message);
  }
  return data as SpendingCategoryRow;
}

export async function ensureSpendingCategory(value: unknown): Promise<string> {
  const categories = await listSpendingCategories();
  const names = categories.map((category) => category.name);
  const existing = findSpendingCategory(value, names);
  if (existing) return existing;
  const created = await createSpendingCategory(value ?? "Other");
  return created.name;
}

export async function mergeSpendingCategories(sourceId: string, targetId: string): Promise<void> {
  if (!sourceId || !targetId || sourceId === targetId) throw new Error("Choose two different categories.");
  const { supabase, ownerUserId } = await getOwnerScope();
  const { data, error } = await supabase
    .from("spending_categories")
    .select("id,name")
    .eq("owner_user_id", ownerUserId)
    .in("id", [sourceId, targetId]);
  if (error) throw new Error(error.message);
  const source = data?.find((category) => category.id === sourceId);
  const target = data?.find((category) => category.id === targetId);
  if (!source || !target) throw new Error("One of those categories no longer exists.");

  const { error: updateError } = await supabase
    .from("spending")
    .update({ category: target.name })
    .eq("owner_user_id", ownerUserId)
    .eq("category", source.name);
  if (updateError) throw new Error(updateError.message);

  const { error: deleteError } = await supabase
    .from("spending_categories")
    .delete()
    .eq("owner_user_id", ownerUserId)
    .eq("id", source.id);
  if (deleteError) throw new Error(deleteError.message);
}

export async function renameSpendingCategory(id: string, value: unknown): Promise<SpendingCategoryRow> {
  const name = cleanSpendingCategory(value);
  if (!id || !name) throw new Error("Choose a category and enter its new name.");
  const { supabase, ownerUserId } = await getOwnerScope();
  const { data: source, error: sourceError } = await supabase
    .from("spending_categories")
    .select("id,name")
    .eq("owner_user_id", ownerUserId)
    .eq("id", id)
    .single();
  if (sourceError) throw new Error(sourceError.message);

  const categories = await listSpendingCategories();
  const duplicate = findSpendingCategory(name, categories.filter((category) => category.id !== id).map((category) => category.name));
  if (duplicate) throw new Error("That category already exists. Merge into it instead.");

  const { data, error } = await supabase
    .from("spending_categories")
    .update({ name })
    .eq("owner_user_id", ownerUserId)
    .eq("id", id)
    .select(CATEGORY_SELECT)
    .single();
  if (error) throw new Error(error.message);

  const { error: spendingError } = await supabase
    .from("spending")
    .update({ category: name })
    .eq("owner_user_id", ownerUserId)
    .eq("category", source.name);
  if (spendingError) {
    await supabase.from("spending_categories").update({ name: source.name }).eq("id", id).eq("owner_user_id", ownerUserId);
    throw new Error(spendingError.message);
  }
  return data as SpendingCategoryRow;
}
