import { createAdminClient } from "./supabase/admin";

export interface ProblemRow {
  id: string;
  text: string;
  solved: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all active/unsolved problems, ordered by created_at ascending.
 */
export async function listActiveProblems(): Promise<ProblemRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("problems")
    .select("id, text, solved, created_at, updated_at")
    .eq("solved", false)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProblemRow[];
}

/**
 * Fetch all problems (both active and solved) for editing page, ordered by solved status and creation date.
 */
export async function listAllProblems(): Promise<ProblemRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("problems")
    .select("id, text, solved, created_at, updated_at")
    .order("solved", { ascending: true }) // active first
    .order("created_at", { ascending: false }); // newest first within groups
  if (error) throw new Error(error.message);
  return (data ?? []) as ProblemRow[];
}

/**
 * Insert a new problem.
 */
export async function insertProblem(text: string): Promise<ProblemRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("problems")
    .insert({ text, solved: false })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ProblemRow;
}

/**
 * Update dynamic fields (like solved status or text).
 */
export async function updateProblem(id: string, patch: Partial<Pick<ProblemRow, "solved" | "text">>): Promise<ProblemRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("problems")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ProblemRow;
}

/**
 * Delete a problem completely.
 */
export async function deleteProblem(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("problems").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
