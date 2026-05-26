import { createAdminClient } from "./supabase/admin";

export interface LearningRow {
  id: string;
  occurred_date: string;
  text: string;
  created_at: string;
}

export async function listLearningsForDate(date: string): Promise<LearningRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("learnings")
    .select("id, occurred_date, text, created_at")
    .eq("occurred_date", date)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as LearningRow[];
}

export async function insertLearning(date: string, text: string): Promise<LearningRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("learnings")
    .insert({ occurred_date: date, text })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LearningRow;
}

export async function deleteLearning(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("learnings").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
