import { type DbScope, resolveDbScope } from "./owner-scope";

export interface QuoteRow {
  id: string;
  text: string;
  author: string | null;
  created_at: string;
}

export async function listAllQuotes(scope?: DbScope): Promise<QuoteRow[]> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const { data, error } = await supabase
    .from("quotes")
    .select("id, text, author, created_at")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as QuoteRow[];
}

export async function insertQuote(text: string, author?: string, scope?: DbScope): Promise<QuoteRow> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const { data, error } = await supabase
    .from("quotes")
    .insert({ owner_user_id: ownerUserId, text, author: author || null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as QuoteRow;
}

export async function deleteQuote(id: string, scope?: DbScope): Promise<void> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const { error } = await supabase.from("quotes").delete().eq("id", id).eq("owner_user_id", ownerUserId);
  if (error) throw new Error(error.message);
}
