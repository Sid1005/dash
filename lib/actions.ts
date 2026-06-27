import { type FoodEntry, type SpendEntry } from "./types";
import { after } from "next/server";
import { insertSpending } from "./spending-supabase";
import { insertLearning } from "./learnings-supabase";
import { insertProblem } from "./problems-supabase";
import { insertIdea, listUniqueCategories } from "./ideas-supabase";
import { classifyIdea } from "./classify-idea";
import { insertFoodEntry } from "./food-supabase";
import { type DbScope, getUserScopedDb } from "./owner-scope";
import { parseInput, type ParsedAction } from "./parse";
import { currentIstDate } from "./time";
import { notifyHermesTaskUpsert, notifyHermesEventUpsert, notifyHermesEventCancel } from "./hermes-reminders";
import type { TaskRow } from "./tasks-types";
import { isSpendCategory } from "./spending";
import { formatINR } from "./currency";
import { normalizeWorkoutExercises, summarizeWorkoutExercises, type RawWorkoutExercise } from "./workout-normalization";
import {
  deleteTimeBlock,
  insertTimeBlock,
  listTimeBlocksForDate,
  updateTimeBlock,
  type TimeBlockEntry,
} from "./time-blocks-supabase";

type TaskInput = {
  title: string;
  due_date?: string;
  due_time?: string;
  due_in_minutes?: number;
};

const IST_TIME_ZONE = "Asia/Kolkata";
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeEventTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function eventLocalPart(value: string, part: "date" | "time"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid calendar event time: ${value}`);
  const options: Intl.DateTimeFormatOptions = part === "date"
    ? { timeZone: IST_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }
    : { timeZone: IST_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  return new Intl.DateTimeFormat("en-CA", options).format(date);
}

function localDateTime(date: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid event date: ${date}`);
  if (!TIME_RE.test(time)) throw new Error(`Invalid event time: ${time}`);
  return `${date}T${time}:00+05:30`;
}

function defaultEventEnd(date: string, start: string): { end: string; endDate: string } {
  const value = new Date(localDateTime(date, start));
  value.setMinutes(value.getMinutes() + 30);
  const iso = value.toISOString();
  return {
    end: eventLocalPart(iso, "time"),
    endDate: eventLocalPart(iso, "date"),
  };
}

function findMatchingEvent(events: TimeBlockEntry[], query: string): TimeBlockEntry[] {
  const normalizedQuery = normalizeEventTitle(query);
  if (!normalizedQuery) return [];
  const exact = events.filter((event) => normalizeEventTitle(event.activity) === normalizedQuery);
  if (exact.length > 0) return exact;
  return events.filter((event) => {
    const title = normalizeEventTitle(event.activity);
    return title.includes(normalizedQuery) || normalizedQuery.includes(title);
  });
}

export async function prepareParsedAction(
  action: ParsedAction,
  date: string,
  scope: DbScope
): Promise<ParsedAction> {
  if (action.type === "calendar_event_create" && !action.data.end) {
    const date = String(action.data.date);
    const { end, endDate } = defaultEventEnd(date, String(action.data.start));
    return {
      ...action,
      data: {
        ...action.data,
        end,
        ...(endDate !== date ? { end_date: endDate } : {}),
      },
    };
  }
  if (action.type !== "calendar_event_update" && action.type !== "calendar_event_delete") return action;
  if (typeof action.data.event_id === "string" && action.data.event_id) return action;

  const eventDate = String(action.data.event_date || date);
  const eventTitle = String(action.data.event_title || "");
  const matches = findMatchingEvent(await listTimeBlocksForDate(eventDate, scope), eventTitle);
  if (matches.length === 0) {
    throw new Error(`I could not find a calendar event matching "${eventTitle}" on ${eventDate}.`);
  }
  if (matches.length > 1) {
    const choices = matches.slice(0, 4).map((event) => `${event.activity} (${event.start})`).join(", ");
    throw new Error(`More than one event matched "${eventTitle}" on ${eventDate}: ${choices}. Please be more specific.`);
  }

  const event = matches[0];
  return {
    ...action,
    data: {
      ...action.data,
      event_id: event.id,
      current_title: event.activity,
      current_date: event.date,
      current_start: event.start,
      current_end: event.end,
      current_category: event.category,
    },
  };
}

function normalizeSpendCategory(raw: string): string {
  if (!raw) return "Other";
  const capitalized = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  if (isSpendCategory(capitalized)) return capitalized;
  const lower = raw.toLowerCase();
  if (lower.includes("food") || lower.includes("groceries") || lower.includes("eat") || lower.includes("restaurant") || lower.includes("coffee")) return "Food";
  if (lower.includes("transport") || lower.includes("uber") || lower.includes("grab") || lower.includes("taxi") || lower.includes("bus") || lower.includes("mrt")) return "Transport";
  if (lower.includes("health") || lower.includes("gym") || lower.includes("medical") || lower.includes("pharmacy")) return "Health";
  if (lower.includes("entertain") || lower.includes("movie") || lower.includes("netflix") || lower.includes("game")) return "Entertainment";
  if (lower.includes("shop") || lower.includes("clothes") || lower.includes("amazon") || lower.includes("purchase")) return "Shopping";
  return "Other";
}

function extractText(data: Record<string, unknown> | null | undefined): string {
  if (!data) return "";
  return (data.text ?? data.description ?? data.content ?? data.message ?? "") as string;
}

function formatDateLabel(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return ` on ${dateStr}`;
    const formatted = d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return ` on *${formatted}*`;
  } catch {
    return ` on ${dateStr}`;
  }
}

async function insertTaskEntry(
  baseDate: string,
  taskData: TaskInput,
  scope: DbScope
): Promise<{ title: string; label: string }> {
  const title = taskData.title ?? "Untitled task";
  const rawDue = taskData.due_date ?? "today";
  const dueInRaw = taskData.due_in_minutes;
  const dueInMinutes =
    typeof dueInRaw === "number"
      ? dueInRaw
      : typeof dueInRaw === "string"
        ? Number.parseFloat(dueInRaw)
        : NaN;
  let dueDate: Date;

  if (Number.isFinite(dueInMinutes) && dueInMinutes >= 0) {
    dueDate = new Date();
    dueDate.setMinutes(dueDate.getMinutes() + Math.round(dueInMinutes));
  } else {
    let targetDateStr = baseDate;
    
    if (rawDue === "tomorrow") {
      const d = new Date(`${baseDate}T00:00:00+05:30`);
      d.setDate(d.getDate() + 1);
      targetDateStr = currentIstDate(d);
    } else if (rawDue !== "today" && /^\d{4}-\d{2}-\d{2}$/.test(rawDue)) {
      targetDateStr = rawDue;
    }

    const targetTimeStr = taskData.due_time ?? "23:59";
    
    dueDate = new Date(`${targetDateStr}T${targetTimeStr}:00+05:30`);
    if (isNaN(dueDate.getTime())) {
      dueDate = new Date(`${baseDate}T23:59:00+05:30`);
    }
  }

  const { data, error } = await scope.supabase
    .from("tasks")
    .insert({ owner_user_id: scope.ownerUserId, title, due_at: dueDate.toISOString(), done: false })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  after(() => notifyHermesTaskUpsert(data as TaskRow));

  const label =
    Number.isFinite(dueInMinutes) && dueInMinutes >= 0
      ? `in ${Math.round(dueInMinutes)} min`
      : rawDue === "today"
        ? "today"
        : rawDue === "tomorrow"
          ? "tomorrow"
          : rawDue;

  return { title, label };
}

export async function applyParsedAction(
  action: ParsedAction,
  date: string,
  scope?: DbScope
): Promise<string> {
  const dbScope = scope ?? await getUserScopedDb();
  const { type, data = {} } = action;
  const targetDate = (data.date as string) || date;

  if (type === "food") {
    const entry = data as unknown as FoodEntry;
    await insertFoodEntry(targetDate, entry, dbScope);
    const est = entry.estimated ? " (estimated)" : "";
    return `Logged ${entry.name}: ${entry.calories} cal, ${entry.protein_g}g protein${est}`;
  }

  if (type === "multiple_food") {
    const entries = (data.entries ?? []) as FoodEntry[];
    const saved = await Promise.all(entries.map((entry) => insertFoodEntry(targetDate, entry, dbScope)));
    const calories = saved.reduce((sum, entry) => sum + (Number(entry.calories) || 0), 0);
    const protein = saved.reduce((sum, entry) => sum + (Number(entry.protein_g) || 0), 0);
    return `Logged ${saved.length} food items: ${Math.round(calories)} cal, ${Math.round(protein)}g protein`;
  }

  if (type === "spending") {
    const entry: SpendEntry = {
      ...(data as unknown as SpendEntry),
      category: normalizeSpendCategory((data.category as string) ?? "Other"),
    };
    await insertSpending(targetDate, entry, dbScope);
    return `Logged ${formatINR(entry.amount)} for ${entry.item}`;
  }

  if (type === "multiple_spending") {
    const expenses = (data.expenses ?? []) as Array<{ item: string; amount: number; category?: string; time?: string }>;
    const saved = await Promise.all(
      expenses.map((e) =>
        insertSpending(targetDate, {
          item: e.item,
          amount: e.amount,
          category: normalizeSpendCategory(e.category ?? "Other"),
          time: e.time ?? "00:00",
        }, dbScope)
      )
    );
    return saved.map((s) => `${formatINR(Number(s.amount))} for ${s.item}`).join(" · ");
  }

  if (type === "food_and_spending") {
    const f = data.food as unknown as FoodEntry;
    const s: SpendEntry = {
      ...(data.spending as unknown as SpendEntry),
      category: normalizeSpendCategory(((data.spending as Record<string, unknown>)?.category as string) ?? "Food"),
    };
    await insertFoodEntry(targetDate, f, dbScope);
    await insertSpending(targetDate, s, dbScope);
    const est = f.estimated ? " (estimated)" : "";
    return `Logged ${f.name}: ${f.calories} cal, ${f.protein_g}g protein${est} · ${formatINR(s.amount)}`;
  }

  if (type === "calendar_event_create") {
    const eventDate = String(data.date || targetDate);
    const defaultEnd = data.end ? null : defaultEventEnd(eventDate, String(data.start));
    const endTime = String(data.end || defaultEnd?.end);
    const endDate = String(data.end_date || defaultEnd?.endDate || eventDate);
    if (endDate !== eventDate) throw new Error("Dash schedule blocks must start and end on the same day.");
    const createdBlock = await insertTimeBlock(eventDate, {
      activity: String(data.title),
      start: String(data.start),
      end: endTime,
      category: "Other",
    }, dbScope);
    after(() => notifyHermesEventUpsert(createdBlock));
    return `Event created: "${data.title}" on ${eventDate}, ${data.start}–${endTime}`;
  }

  if (type === "calendar_event_update") {
    const event = (await prepareParsedAction(action, targetDate, dbScope)).data;
    const currentStart = String(event.current_start);
    const currentEnd = String(event.current_end);
    const currentDate = String(event.current_date || event.event_date || targetDate);
    const nextDate = String(event.new_date || currentDate);
    const currentDuration = new Date(localDateTime(currentDate, currentEnd)).getTime()
      - new Date(localDateTime(currentDate, currentStart)).getTime();
    let start: string | undefined = typeof event.new_start === "string" ? event.new_start : undefined;
    let end: string | undefined = typeof event.new_end === "string" ? event.new_end : undefined;

    if (event.new_start || event.new_date) {
      start = String(event.new_start || currentStart);
      if (!event.new_end) {
        end = eventLocalPart(
          new Date(new Date(localDateTime(nextDate, start)).getTime() + currentDuration).toISOString(),
          "time"
        );
      }
    }
    if (start && end && end <= start) {
      throw new Error("Updated calendar event end must be after its start.");
    }

    const updatedBlock = await updateTimeBlock(String(event.event_id), {
      activity: typeof event.new_title === "string" ? event.new_title : undefined,
      date: nextDate,
      start,
      end,
    }, dbScope);
    after(() => notifyHermesEventUpsert(updatedBlock));
    return `Event updated: "${event.new_title || event.current_title}"`;
  }

  if (type === "calendar_event_delete") {
    const event = (await prepareParsedAction(action, targetDate, dbScope)).data;
    const deletedId = String(event.event_id);
    await deleteTimeBlock(deletedId, dbScope);
    after(() => notifyHermesEventCancel(deletedId));
    return `Event deleted: "${event.current_title}"`;
  }

  if (type === "task") {
    const { title, label } = await insertTaskEntry(targetDate, data as unknown as TaskInput, dbScope);
    return `Task added: "${title}" due ${label}`;
  }

  if (type === "tasks") {
    const tasks = (data.tasks ?? []) as Array<{ title: string; due_date?: string; due_time?: string; due_in_minutes?: number }>;
    const saved = await Promise.all(
      tasks.map((t) => insertTaskEntry(targetDate, t, dbScope))
    );
    return saved.map((s) => `"${s.title}" due ${s.label}`).join(" · ");
  }

  if (type === "learning") {
    const text = extractText(data);
    await insertLearning(targetDate, text, dbScope);
    return `Learning logged: "${text.slice(0, 60)}"`;
  }

  if (type === "idea") {
    const text = extractText(data);
    const existingCategories = await listUniqueCategories(dbScope);
    const category = await classifyIdea(text, existingCategories);
    const idea = await insertIdea(text, category, dbScope);
    return `Idea logged under "${idea.category}": "${text.slice(0, 60)}"`;
  }

  if (type === "problem") {
    const text = extractText(data);
    await insertProblem(text, dbScope);
    return `Problem logged: "${text.slice(0, 60)}"`;
  }

  if (type === "workout") {
    const workoutDate = (data.date as string) || targetDate;
    const exercises = (data.exercises as RawWorkoutExercise[]) ?? [];
    // Insert workout row
    const { data: wk, error: wkErr } = await dbScope.supabase
      .from("workouts")
      .insert({ owner_user_id: dbScope.ownerUserId, occurred_date: workoutDate })
      .select("id")
      .single();
    if (wkErr) throw new Error(wkErr.message);

    // Insert one row per set per exercise. Weight-only entries are represented
    // with reps = 0 so the exercise is still saved.
    const setRows = normalizeWorkoutExercises(exercises).map((s) => ({
        workout_id: wk.id,
        owner_user_id: dbScope.ownerUserId,
        exercise_name: s.exercise_name,
        set_number: s.set_number,
        reps: s.reps,
        weight_kg: s.weight_kg,
        notes: s.notes,
      }));
    if (setRows.length > 0) {
      const { error: exErr } = await dbScope.supabase.from("workout_exercises").insert(setRows);
      if (exErr) throw new Error(exErr.message);
    }

    const summary = summarizeWorkoutExercises(exercises);
    return `Workout logged: ${summary || "no exercises recorded"}`;
  }

  if (type === "chat") {
    return (data.response as string) || "I am not sure what you mean.";
  }

  return "I did not save this because generic notes are disabled.";
}

export async function handleNaturalLanguage(
  input: string,
  date: string,
  now: string,
  scope?: DbScope
): Promise<{ action: ParsedAction; message: string }> {
  const combinedNow = `${date} ${now}`;
  const dbScope = scope ?? await getUserScopedDb();
  const action = await prepareParsedAction(await parseInput(input, combinedNow), date, dbScope);
  const message = await applyParsedAction(action, date, dbScope);
  return { action, message };
}

export async function parseNaturalLanguage(
  input: string,
  now: string,
  pendingAction?: ParsedAction,
  base64Image?: string
): Promise<ParsedAction> {
  return parseInput(input, now, pendingAction, base64Image);
}

export function formatActionPreview(action: ParsedAction): string {
  const { type, data } = action;

  if (type === "food") {
    const entry = data as unknown as FoodEntry;
    const est = entry.estimated ? " (estimated)" : "";
    const dateLabel = formatDateLabel(data.date as string);
    return `I found *${entry.name}*${dateLabel} -> *${entry.calories} cal*, *${entry.protein_g}g protein*${est}.\nNote it down? Reply *yes* or *no*.`;
  }

  if (type === "multiple_food") {
    const entries = (data.entries ?? []) as FoodEntry[];
    const dateLabel = formatDateLabel(data.date as string);
    const calories = entries.reduce((sum, entry) => sum + (Number(entry.calories) || 0), 0);
    const protein = entries.reduce((sum, entry) => sum + (Number(entry.protein_g) || 0), 0);
    const preview = entries.slice(0, 8).map((entry) => `*${entry.name}* -> ${entry.calories} cal, ${entry.protein_g}g protein`).join("\n");
    const more = entries.length > 8 ? `\n…and ${entries.length - 8} more` : "";
    return `I found ${entries.length} food items${dateLabel} -> *${Math.round(calories)} cal*, *${Math.round(protein)}g protein* estimated total.\n${preview}${more}\nNote them down? Reply *yes* or *no*.`;
  }

  if (type === "food_and_spending") {
    const f = data.food as unknown as FoodEntry;
    const s = data.spending as unknown as SpendEntry;
    const est = f.estimated ? " (estimated)" : "";
    const spendingDate = (data.spending as { date?: string } | undefined)?.date;
    const foodDate = (data.food as { date?: string } | undefined)?.date;
    const dateLabel = formatDateLabel((data.date as string) || spendingDate || foodDate);
    return `I found *${f.name}* -> *${f.calories} cal*, *${f.protein_g}g protein*${est}, and *${formatINR(s.amount)}* spend${dateLabel}.\nNote it down? Reply *yes* or *no*.`;
  }

  if (type === "spending") {
    const entry = data as unknown as SpendEntry;
    const dateLabel = formatDateLabel(data.date as string);
    return `I parsed a spend${dateLabel}: *${formatINR(entry.amount)}* for *${entry.item}*.\nNote it down? Reply *yes* or *no*.`;
  }

  if (type === "multiple_spending") {
    const expenses = (data.expenses ?? []) as Array<{ item: string; amount: number; category?: string }>;
    const lines = expenses.map((e) => `*${formatINR(e.amount)}* for *${e.item}*`).join("\n");
    const dateLabel = formatDateLabel(data.date as string);
    return `I found ${expenses.length} expenses${dateLabel}:\n${lines}\nSave them? Reply *yes* or *no*.`;
  }

  if (type === "calendar_event_create") {
    const location = data.location ? ` at *${data.location}*` : "";
    return `Create event *${data.title}*${location} on *${data.date}*, *${data.start}–${data.end}*? Reply *yes* or *no*.`;
  }

  if (type === "calendar_event_update") {
    const changes = [
      data.new_title && `title to *${data.new_title}*`,
      data.new_date && `date to *${data.new_date}*`,
      data.new_start && `start to *${data.new_start}*`,
      data.new_end && `end to *${data.new_end}*`,
      data.new_location && `location to *${data.new_location}*`,
      data.new_description && "description",
    ].filter(Boolean).join(", ");
    return `Update event *${data.current_title || data.event_title}* on *${data.event_date}* — ${changes || "requested details"}? Reply *yes* or *no*.`;
  }

  if (type === "calendar_event_delete") {
    return `Delete event *${data.current_title || data.event_title}* on *${data.event_date}*? Reply *yes* or *no*.`;
  }

  if (type === "task") {
    const rawMin = data.due_in_minutes;
    const mins =
      typeof rawMin === "number"
        ? rawMin
        : typeof rawMin === "string"
          ? Number.parseFloat(rawMin)
          : NaN;
    if (Number.isFinite(mins) && mins >= 0) {
      return `I parsed a task: *${data.title}*, due *in ${Math.round(mins)} min*.\nSave it? Reply *yes* or *no*.`;
    }
    const due = (data.due_date as string) ?? "today";
    return `I parsed a task: *${data.title}*, due *${due}*.\nSave it? Reply *yes* or *no*.`;
  }

  if (type === "tasks") {
    const tasks = (data.tasks ?? []) as Array<{ title: string; due_date?: string; due_time?: string; due_in_minutes?: number }>;
    const lines = tasks.map((t) => {
      const rawMin = t.due_in_minutes;
      const mins =
        typeof rawMin === "number"
          ? rawMin
          : typeof rawMin === "string"
            ? Number.parseFloat(rawMin)
            : NaN;
      if (Number.isFinite(mins) && mins >= 0) {
        return `*${t.title}* (due in ${Math.round(mins)} min)`;
      }
      const due = t.due_date ?? "today";
      return `*${t.title}* (due ${due})`;
    }).join("\n");
    return `I found ${tasks.length} tasks:\n${lines}\nSave them? Reply *yes* or *no*.`;
  }

  if (type === "learning") {
    const dateLabel = formatDateLabel(data.date as string);
    return `I parsed a learning note${dateLabel}.\nNote it down? Reply *yes* or *no*.`;
  }

  if (type === "idea") {
    return `I parsed an idea: *${data.text}*.\nNote it down? Reply *yes* or *no*.`;
  }

  if (type === "problem") {
    return `I parsed a problem: *${data.text}*.\nLog it? Reply *yes* or *no*.`;
  }

  if (type === "workout") {
    const dateLabel = formatDateLabel(data.date as string);
    return `I parsed a workout${dateLabel}.\nNote it down? Reply *yes* or *no*.`;
  }

  if (type === "chat") {
    return data.response as string;
  }

  return "I could not classify this as a supported log, so I did not save it.";
}
