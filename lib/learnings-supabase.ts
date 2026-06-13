import { type DbScope, resolveDbScope } from "./owner-scope";

export interface LearningRow {
  id: string;
  occurred_date: string;
  text: string;
  created_at: string;
}

export async function listLearningsForDate(date: string, scope?: DbScope): Promise<LearningRow[]> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const { data, error } = await supabase
    .from("learnings")
    .select("id, occurred_date, text, created_at")
    .eq("owner_user_id", ownerUserId)
    .eq("occurred_date", date)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as LearningRow[];
}

export async function listLearningsInRange(startDate: string, endDate: string, scope?: DbScope): Promise<LearningRow[]> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const { data, error } = await supabase
    .from("learnings")
    .select("id, occurred_date, text, created_at")
    .eq("owner_user_id", ownerUserId)
    .gte("occurred_date", startDate)
    .lte("occurred_date", endDate)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as LearningRow[];
}

export async function insertLearning(date: string, text: string, scope?: DbScope): Promise<LearningRow> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const { data, error } = await supabase
    .from("learnings")
    .insert({ owner_user_id: ownerUserId, occurred_date: date, text })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LearningRow;
}

export async function deleteLearning(id: string, scope?: DbScope): Promise<void> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const { error } = await supabase.from("learnings").delete().eq("id", id).eq("owner_user_id", ownerUserId);
  if (error) throw new Error(error.message);
}
