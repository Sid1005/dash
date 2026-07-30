import "server-only";
import { getOwnerScope } from "@/lib/owner-scope";
import { endOfIstDayIso, startOfIstDayIso } from "@/lib/time";
import type { TaskRow } from "@/lib/types";

export async function listTasks(options: {
  startDate?: string;
  endDate?: string;
  status?: "open" | "done" | "all";
  limit?: number;
} = {}): Promise<TaskRow[]> {
  const { supabase, ownerUserId } = await getOwnerScope();
  let query = supabase
    .from("tasks")
    .select("id,title,due_at,done,completed_at,created_at,updated_at")
    .eq("owner_user_id", ownerUserId)
    .order("done", { ascending: true })
    .order("due_at", { ascending: true });
  if (options.startDate) query = query.gte("due_at", startOfIstDayIso(options.startDate));
  if (options.endDate) query = query.lte("due_at", endOfIstDayIso(options.endDate));
  if (options.status === "open") query = query.eq("done", false);
  if (options.status === "done") query = query.eq("done", true);
  if (options.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as TaskRow[];
}

export async function insertTask(title: string, dueAt: string): Promise<TaskRow> {
  const cleanTitle = title.trim().slice(0, 2000);
  if (!cleanTitle) throw new Error("Task title is required.");
  if (Number.isNaN(Date.parse(dueAt))) throw new Error("Task due date is invalid.");
  const { supabase, ownerUserId } = await getOwnerScope();
  const { data, error } = await supabase
    .from("tasks")
    .insert({ owner_user_id: ownerUserId, title: cleanTitle, due_at: dueAt, done: false })
    .select("id,title,due_at,done,completed_at,created_at,updated_at")
    .single();
  if (error) throw new Error(error.message);
  return data as TaskRow;
}

export async function updateTask(id: string, patch: { title?: string; due_at?: string; done?: boolean }): Promise<TaskRow> {
  const payload: Record<string, unknown> = {};
  if (typeof patch.title === "string" && patch.title.trim()) payload.title = patch.title.trim().slice(0, 2000);
  if (typeof patch.due_at === "string" && !Number.isNaN(Date.parse(patch.due_at))) payload.due_at = patch.due_at;
  if (typeof patch.done === "boolean") {
    payload.done = patch.done;
    payload.completed_at = patch.done ? new Date().toISOString() : null;
  }
  if (Object.keys(payload).length === 0) throw new Error("No valid task changes were provided.");
  const { supabase, ownerUserId } = await getOwnerScope();
  const { data, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .select("id,title,due_at,done,completed_at,created_at,updated_at")
    .single();
  if (error) throw new Error(error.message);
  return data as TaskRow;
}

export async function deleteTask(id: string): Promise<void> {
  const { supabase, ownerUserId } = await getOwnerScope();
  const { error } = await supabase.from("tasks").delete().eq("id", id).eq("owner_user_id", ownerUserId);
  if (error) throw new Error(error.message);
}
