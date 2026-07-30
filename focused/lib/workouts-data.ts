import "server-only";
import { getOwnerScope } from "@/lib/owner-scope";
import { istDateFromIso } from "@/lib/time";
import type { WorkoutCategory, WorkoutExerciseInput, WorkoutSession, WorkoutSet } from "@/lib/types";
import {
  exerciseKey,
  normalizeWorkoutExercises,
} from "@/lib/workout-normalization";

const SESSION_SELECT = `
  id,title,title_confirmed,session_category,occurred_date,
  session_started_at,session_last_logged_at,created_at,
  workout_exercises(id,exercise_name,set_number,reps,weight_kg,notes,created_at)
`;

function normalizeSession(row: Record<string, unknown>): WorkoutSession {
  const sets: WorkoutSet[] = ((row.workout_exercises ?? []) as Array<Record<string, unknown>>)
    .map((set): WorkoutSet => ({
      ...set,
      id: String(set.id),
      exercise_name: String(set.exercise_name),
      set_number: Number(set.set_number),
      reps: Number(set.reps),
      weight_kg: Number(set.weight_kg),
      notes: String(set.notes ?? ""),
      created_at: String(set.created_at ?? ""),
    } as WorkoutSet))
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.set_number - b.set_number);
  return { ...row, workout_exercises: sets } as unknown as WorkoutSession;
}

export async function getWorkoutSession(id: string): Promise<WorkoutSession | null> {
  const { supabase, ownerUserId } = await getOwnerScope();
  const { data, error } = await supabase
    .from("workouts")
    .select(SESSION_SELECT)
    .eq("owner_user_id", ownerUserId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeSession(data as Record<string, unknown>) : null;
}

export async function listWorkoutSessions(options: {
  category?: WorkoutCategory;
  startDate?: string;
  endDate?: string;
  limit?: number;
} = {}): Promise<WorkoutSession[]> {
  const { supabase, ownerUserId } = await getOwnerScope();
  let query = supabase
    .from("workouts")
    .select(SESSION_SELECT)
    .eq("owner_user_id", ownerUserId)
    .order("occurred_date", { ascending: false })
    .order("session_started_at", { ascending: false });
  if (options.category) query = query.eq("session_category", options.category);
  if (options.startDate) query = query.gte("occurred_date", options.startDate);
  if (options.endDate) query = query.lte("occurred_date", options.endDate);
  if (options.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => normalizeSession(row as Record<string, unknown>));
}

export async function appendWorkoutLog(options: {
  exercises: WorkoutExerciseInput[];
  loggedAt: string;
  category: WorkoutCategory;
  title?: string;
  forceNew?: boolean;
}): Promise<{ session: WorkoutSession; created: boolean; needsTitle: boolean }> {
  const sets = normalizeWorkoutExercises(options.exercises);
  if (sets.length === 0) throw new Error("At least one workout exercise is required.");
  const loggedAtDate = new Date(options.loggedAt);
  if (Number.isNaN(loggedAtDate.getTime())) throw new Error("Workout time is invalid.");

  const { supabase, ownerUserId } = await getOwnerScope();
  const occurredDate = istDateFromIso(loggedAtDate.toISOString());
  const windowStart = new Date(loggedAtDate.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const { data: activeRows, error: activeError } = await supabase
    .from("workouts")
    .select(SESSION_SELECT)
    .eq("owner_user_id", ownerUserId)
    .eq("occurred_date", occurredDate)
    .gte("session_started_at", windowStart)
    .lte("session_started_at", loggedAtDate.toISOString())
    .order("session_started_at", { ascending: false })
    .limit(1);
  if (activeError) throw new Error(activeError.message);

  const active = !options.forceNew && activeRows?.[0] ? normalizeSession(activeRows[0] as Record<string, unknown>) : null;
  let sessionId: string;
  let created = false;
  let titleConfirmed = Boolean(options.title?.trim());
  const incomingCategory = options.category;

  if (active) {
    sessionId = active.id;
    titleConfirmed = active.title_confirmed;
  } else {
    created = true;
    const { data: inserted, error } = await supabase
      .from("workouts")
      .insert({
        owner_user_id: ownerUserId,
        occurred_date: occurredDate,
        title: options.title?.trim().slice(0, 120) || incomingCategory,
        title_confirmed: titleConfirmed,
        session_category: incomingCategory,
        session_started_at: loggedAtDate.toISOString(),
        session_last_logged_at: loggedAtDate.toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    sessionId = inserted.id;
  }

  const existingSets = active?.workout_exercises ?? [];
  const nextNumbers = new Map<string, number>();
  for (const set of existingSets) {
    const key = exerciseKey(set.exercise_name);
    nextNumbers.set(key, Math.max(nextNumbers.get(key) ?? 0, set.set_number));
  }
  const rows = sets.map((set) => {
    const key = exerciseKey(set.exercise_name);
    const next = (nextNumbers.get(key) ?? 0) + 1;
    nextNumbers.set(key, next);
    return {
      workout_id: sessionId,
      owner_user_id: ownerUserId,
      exercise_name: set.exercise_name,
      set_number: next,
      reps: set.reps,
      weight_kg: set.weight_kg,
      notes: set.notes,
    };
  });
  const { error: insertError } = await supabase.from("workout_exercises").insert(rows);
  if (insertError) {
    if (created) await supabase.from("workouts").delete().eq("id", sessionId).eq("owner_user_id", ownerUserId);
    throw new Error(insertError.message);
  }

  const update: Record<string, unknown> = {
    session_last_logged_at: loggedAtDate.toISOString(),
    session_category: active?.session_category ?? incomingCategory,
  };
  if (!titleConfirmed) update.title = active?.session_category ?? incomingCategory;
  const { error: updateError } = await supabase
    .from("workouts")
    .update(update)
    .eq("id", sessionId)
    .eq("owner_user_id", ownerUserId);
  if (updateError) throw new Error(updateError.message);

  const session = await getWorkoutSession(sessionId);
  if (!session) throw new Error("Workout session could not be reloaded.");
  return { session, created, needsTitle: !session.title_confirmed };
}

export async function updateWorkoutSession(id: string, options: {
  title: string;
  occurredDate: string;
  category: WorkoutCategory;
  exercises: WorkoutExerciseInput[];
}): Promise<WorkoutSession> {
  const title = options.title.trim().slice(0, 120);
  if (!title) throw new Error("Workout title is required.");
  const sets = normalizeWorkoutExercises(options.exercises);
  if (sets.length === 0) throw new Error("At least one workout exercise is required.");
  const existing = await getWorkoutSession(id);
  if (!existing) throw new Error("Workout session was not found.");
  const { supabase, ownerUserId } = await getOwnerScope();

  const incomingIds = new Set(sets.flatMap((set) => set.id ? [set.id] : []));
  const removedIds = existing.workout_exercises
    .map((set) => set.id)
    .filter((setId) => !incomingIds.has(setId));
  const existingRows = sets.filter((set) => Boolean(set.id));
  const newRows = sets.filter((set) => !set.id).map((set) => ({
    workout_id: id,
    owner_user_id: ownerUserId,
    exercise_name: set.exercise_name,
    set_number: set.set_number,
    reps: set.reps,
    weight_kg: set.weight_kg,
    notes: set.notes,
  }));

  if (newRows.length > 0) {
    const { error } = await supabase.from("workout_exercises").insert(newRows);
    if (error) throw new Error(error.message);
  }
  for (const set of existingRows) {
    const { error } = await supabase
      .from("workout_exercises")
      .update({
        exercise_name: set.exercise_name,
        set_number: set.set_number,
        reps: set.reps,
        weight_kg: set.weight_kg,
        notes: set.notes,
      })
      .eq("id", set.id as string)
      .eq("workout_id", id)
      .eq("owner_user_id", ownerUserId);
    if (error) throw new Error(error.message);
  }
  if (removedIds.length > 0) {
    const { error } = await supabase
      .from("workout_exercises")
      .delete()
      .eq("workout_id", id)
      .eq("owner_user_id", ownerUserId)
      .in("id", removedIds);
    if (error) throw new Error(error.message);
  }

  const sessionTime = new Date(`${options.occurredDate}T12:00:00+05:30`).toISOString();
  const { error: updateError } = await supabase
    .from("workouts")
    .update({
      occurred_date: options.occurredDate,
      title,
      title_confirmed: true,
      session_category: options.category,
      session_started_at: sessionTime,
      session_last_logged_at: sessionTime,
    })
    .eq("id", id)
    .eq("owner_user_id", ownerUserId);
  if (updateError) throw new Error(updateError.message);

  const session = await getWorkoutSession(id);
  if (!session) throw new Error("Workout session could not be reloaded.");
  return session;
}

export async function titleWorkoutSession(id: string, title: string): Promise<WorkoutSession> {
  const cleanTitle = title.trim().slice(0, 120);
  if (!cleanTitle) throw new Error("Workout title is required.");
  const { supabase, ownerUserId } = await getOwnerScope();
  const { data, error } = await supabase
    .from("workouts")
    .update({ title: cleanTitle, title_confirmed: true })
    .eq("id", id)
    .eq("owner_user_id", ownerUserId)
    .select(SESSION_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return normalizeSession(data as Record<string, unknown>);
}

export async function deleteWorkoutSession(id: string): Promise<void> {
  const { supabase, ownerUserId } = await getOwnerScope();
  const { error } = await supabase.from("workouts").delete().eq("id", id).eq("owner_user_id", ownerUserId);
  if (error) throw new Error(error.message);
}

export function groupWorkoutExercises(sets: WorkoutSet[]) {
  const groups = new Map<string, WorkoutSet[]>();
  for (const set of sets) {
    const group = groups.get(set.exercise_name) ?? [];
    group.push(set);
    groups.set(set.exercise_name, group);
  }
  return Array.from(groups, ([name, groupSets]) => ({ name, sets: groupSets.sort((a, b) => a.set_number - b.set_number) }));
}
