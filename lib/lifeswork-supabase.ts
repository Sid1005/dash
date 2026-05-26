import { createAdminClient } from "./supabase/admin";

export async function readLifeworkSection(section: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("lifeswork")
    .select("content")
    .eq("section", section)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.content as string) ?? "";
}

export async function writeLifeworkSection(section: string, content: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("lifeswork")
    .upsert({ section, content, updated_at: new Date().toISOString() }, { onConflict: "section" });
  if (error) throw new Error(error.message);
}

export async function appendLifeworkSection(section: string, line: string): Promise<void> {
  const existing = await readLifeworkSection(section);
  const updated = (existing.trimEnd() ? existing.trimEnd() + "\n- " : "- ") + line + "\n";
  await writeLifeworkSection(section, updated);
}
