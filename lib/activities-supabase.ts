import { createAdminClient } from "@/lib/supabase/admin";
import { currentIstTime } from "@/lib/time";

export type ActivityActor = "telegram" | "agent" | "calendar" | "system" | "user";
export type ActivityKind = "note" | "activity" | "agent_event";

export type ActivityEntry = {
  id: string;
  date: string;
  time: string;
  actor: ActivityActor;
  kind: ActivityKind;
  verb: string;
  body: string;
  metadata: Record<string, unknown>;
};

type ActivityRow = {
  id: string;
  occurred_date: string;
  time_local: string;
  actor: ActivityActor;
  kind: ActivityKind;
  verb: string;
  body: string;
  metadata: Record<string, unknown> | null;
};

type ActivityInput = {
  time?: string;
  actor?: ActivityActor;
  kind?: ActivityKind;
  verb?: string;
  body: string;
  metadata?: Record<string, unknown>;
};

function normalizeTime(time?: string) {
  const trimmed = time?.trim();
  return trimmed && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(trimmed)
    ? trimmed
    : currentIstTime();
}

function rowToEntry(row: ActivityRow): ActivityEntry {
  return {
    id: row.id,
    date: row.occurred_date,
    time: row.time_local,
    actor: row.actor,
    kind: row.kind,
    verb: row.verb,
    body: row.body,
    metadata: row.metadata ?? {},
  };
}

function isMissingTableError(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.message?.toLowerCase().includes("activities") &&
      error.message.toLowerCase().includes("could not find")
  );
}

export async function listActivitiesForDate(date: string): Promise<ActivityEntry[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("occurred_date", date)
    .order("time_local", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as ActivityRow[]).map(rowToEntry);
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("activities")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function insertActivity(date: string, input: ActivityInput): Promise<ActivityEntry> {
  const body = input.body.trim();
  if (!body) throw new Error("Activity body is required.");

  const payload = {
    occurred_date: date,
    time_local: normalizeTime(input.time),
    actor: input.actor ?? "telegram",
    kind: input.kind ?? "note",
    verb: (input.verb ?? "noted").trim() || "noted",
    body,
    metadata: input.metadata ?? {},
  };

  const { data, error } = await createAdminClient()
    .from("activities")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return rowToEntry(data as ActivityRow);
}
