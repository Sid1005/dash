import { type DbScope, resolveDbScope } from "@/lib/owner-scope";

export const TIME_BLOCK_CATEGORIES = [
  "Deep Work",
  "Admin",
  "Meetings",
  "Personal",
  "Health",
  "Learning",
  "Other",
] as const;

export type TimeBlockCategory = (typeof TIME_BLOCK_CATEGORIES)[number];

export type TimeBlockEntry = {
  id: string;
  date: string;
  start: string;
  end: string;
  activity: string;
  category: TimeBlockCategory;
};

type TimeBlockRow = {
  id: string;
  occurred_date: string;
  start_local: string;
  end_local: string;
  activity: string;
  category: TimeBlockCategory;
};

type TimeBlockInput = {
  start: string;
  end: string;
  activity: string;
  category?: string;
};

const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

function normalizeTime(time: string): string {
  const trimmed = time?.trim();
  if (!trimmed || !TIME_RE.test(trimmed)) {
    throw new Error(`Invalid time (expected HH:MM): ${time}`);
  }
  return trimmed;
}

function normalizeCategory(raw?: string): TimeBlockCategory {
  if (!raw) return "Other";
  const found = TIME_BLOCK_CATEGORIES.find(
    (cat) => cat.toLowerCase() === raw.trim().toLowerCase()
  );
  return found ?? "Other";
}

function rowToEntry(row: TimeBlockRow): TimeBlockEntry {
  return {
    id: row.id,
    date: row.occurred_date,
    start: row.start_local,
    end: row.end_local,
    activity: row.activity,
    category: row.category,
  };
}

function isMissingTableError(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    (error.message?.toLowerCase().includes("time_blocks") &&
      error.message.toLowerCase().includes("could not find"))
  );
}

export async function listTimeBlocksForDate(
  date: string,
  scope?: DbScope
): Promise<TimeBlockEntry[]> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const { data, error } = await supabase
    .from("time_blocks")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .eq("occurred_date", date)
    .order("start_local", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as TimeBlockRow[]).map(rowToEntry);
}

export async function insertTimeBlock(
  date: string,
  input: TimeBlockInput,
  scope?: DbScope
): Promise<TimeBlockEntry> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const activity = input.activity?.trim();
  if (!activity) throw new Error("Time block activity is required.");

  const start = normalizeTime(input.start);
  const end = normalizeTime(input.end);
  if (end <= start) {
    throw new Error(
      `Time block end (${end}) must be after start (${start}).`
    );
  }

  const payload = {
    owner_user_id: ownerUserId,
    occurred_date: date,
    start_local: start,
    end_local: end,
    activity,
    category: normalizeCategory(input.category),
  };

  const { data, error } = await supabase
    .from("time_blocks")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return rowToEntry(data as TimeBlockRow);
}

export async function deleteTimeBlock(id: string, scope?: DbScope): Promise<void> {
  const { supabase, ownerUserId } = await resolveDbScope(scope);
  const trimmed = id?.trim();
  if (!trimmed) throw new Error("Time block id is required.");

  const { error } = await supabase
    .from("time_blocks")
    .delete()
    .eq("id", trimmed)
    .eq("owner_user_id", ownerUserId);

  if (error) throw new Error(error.message);
}
