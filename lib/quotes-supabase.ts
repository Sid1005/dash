import { createAdminClient } from "./supabase/admin";

export interface QuoteRow {
  id: string;
  text: string;
  author: string | null;
  created_at: string;
}

export async function listAllQuotes(): Promise<QuoteRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("id, text, author, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as QuoteRow[];
}

export async function insertQuote(text: string, author?: string): Promise<QuoteRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("quotes")
    .insert({ text, author: author || null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as QuoteRow;
}

export async function deleteQuote(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
