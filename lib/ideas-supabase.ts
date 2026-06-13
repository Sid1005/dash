import { type DbScope, resolveDbScope } from "./owner-scope";

export interface IdeaRow {
  id: string;
  text: string;
  category: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

/**
  * Fetch all active (non-archived) ideas, ordered by created_at descending.
  */
export async function listActiveIdeas(scope?: DbScope): Promise<IdeaRow[]> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const { data, error } = await supabase
    .from("ideas")
    .select("id, text, category, archived, created_at, updated_at")
    .eq("owner_user_id", ownerUserId)
    .eq("archived", false)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as IdeaRow[];
}

/**
  * Fetch all ideas (active and archived), ordered by archived status (active first) and creation date.
  */
export async function listAllIdeas(scope?: DbScope): Promise<IdeaRow[]> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const { data, error } = await supabase
    .from("ideas")
    .select("id, text, category, archived, created_at, updated_at")
    .eq("owner_user_id", ownerUserId)
    .order("archived", { ascending: true }) // active first
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as IdeaRow[];
}

/**
  * Fetch all unique active category names.
  */
export async function listUniqueCategories(scope?: DbScope): Promise<string[]> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const { data, error } = await supabase
    .from("ideas")
    .select("category")
    .eq("owner_user_id", ownerUserId)
    .eq("archived", false);
  if (error) throw new Error(error.message);
  
  const categories = new Set<string>();
  if (data) {
    data.forEach((row: { category: string }) => {
      if (row.category && row.category.trim()) {
        categories.add(row.category.trim());
      }
    });
  }
  return Array.from(categories).sort();
}

/**
  * Insert a new idea.
  */
export async function insertIdea(text: string, category: string, scope?: DbScope): Promise<IdeaRow> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const { data, error } = await supabase
    .from("ideas")
    .insert({ owner_user_id: ownerUserId, text, category, archived: false })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as IdeaRow;
}

/**
  * Update dynamic fields of an idea.
  */
export async function updateIdea(id: string, patch: Partial<Pick<IdeaRow, "archived" | "text" | "category">>, scope?: DbScope): Promise<IdeaRow> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const { data, error } = await supabase
    .from("ideas")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as IdeaRow;
}

/**
  * Delete an idea completely.
  */
export async function deleteIdea(id: string, scope?: DbScope): Promise<void> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const { error } = await supabase.from("ideas").delete().eq("id", id).eq("owner_user_id", ownerUserId);
  if (error) throw new Error(error.message);
}
