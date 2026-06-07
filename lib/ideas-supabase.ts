import { createAdminClient } from "./supabase/admin";

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
export async function listActiveIdeas(): Promise<IdeaRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ideas")
    .select("id, text, category, archived, created_at, updated_at")
    .eq("archived", false)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as IdeaRow[];
}

/**
  * Fetch all ideas (active and archived), ordered by archived status (active first) and creation date.
  */
export async function listAllIdeas(): Promise<IdeaRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ideas")
    .select("id, text, category, archived, created_at, updated_at")
    .order("archived", { ascending: true }) // active first
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as IdeaRow[];
}

/**
  * Fetch all unique active category names.
  */
export async function listUniqueCategories(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ideas")
    .select("category")
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
export async function insertIdea(text: string, category: string): Promise<IdeaRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ideas")
    .insert({ text, category, archived: false })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as IdeaRow;
}

/**
  * Update dynamic fields of an idea.
  */
export async function updateIdea(id: string, patch: Partial<Pick<IdeaRow, "archived" | "text" | "category">>): Promise<IdeaRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ideas")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as IdeaRow;
}

/**
  * Delete an idea completely.
  */
export async function deleteIdea(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("ideas").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
