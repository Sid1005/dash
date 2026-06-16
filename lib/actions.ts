import { type FoodEntry, type SpendEntry, type TimeBlock } from "./types";
import { insertSpending } from "./spending-supabase";
import { insertLearning } from "./learnings-supabase";
import { insertProblem } from "./problems-supabase";
import { insertIdea, listUniqueCategories } from "./ideas-supabase";
import { classifyIdea } from "./classify-idea";
import { insertFoodEntry } from "./food-supabase";
import { insertTimeBlock } from "./time-blocks-supabase";
import { type DbScope, getUserScopedDb } from "./owner-scope";
import { parseInput, type ParsedAction } from "./parse";
import { currentIstDate } from "./time";

const VALID_SPEND_CATEGORIES = new Set([
  "Food", "Transport", "Health", "Entertainment", "Shopping", "Other",
]);

type TaskInput = {
  title: string;
  due_date?: string;
  due_time?: string;
  due_in_minutes?: number;
};

function normalizeSpendCategory(raw: string): string {
  if (!raw) return "Other";
  const capitalized = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  if (VALID_SPEND_CATEGORIES.has(capitalized)) return capitalized;
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

  const { error } = await scope.supabase
    .from("tasks")
    .insert({ owner_user_id: scope.ownerUserId, title, due_at: dueDate.toISOString(), done: false });
  if (error) throw new Error(error.message);

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
    return `Logged ₹${entry.amount} for ${entry.item}`;
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
    return saved.map((s) => `₹${s.amount} for ${s.item}`).join(" · ");
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
    return `Logged ${f.name}: ${f.calories} cal, ${f.protein_g}g protein${est} · ₹${s.amount}`;
  }

  if (type === "time_block") {
    const block = data as unknown as TimeBlock;
    const saved = await insertTimeBlock(targetDate, block, dbScope);
    return `Logged ${saved.start}–${saved.end}: ${saved.activity}`;
  }

  if (type === "time_blocks") {
    const blocks = (data.blocks ?? []) as Array<{ start: string; end: string; activity: string; category?: string }>;
    const saved = await Promise.all(blocks.map((b) => insertTimeBlock(targetDate, b, dbScope)));
    return saved.map((s) => `${s.start}–${s.end}: ${s.activity}`).join(" · ");
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
    type ExerciseSet = { reps: number; weight_kg: number };
    type Exercise = { name: string; sets: ExerciseSet[]; notes?: string };
    const workoutDate = (data.date as string) || targetDate;
    const exercises = (data.exercises as Exercise[]) ?? [];
    // Insert workout row
    const { data: wk, error: wkErr } = await dbScope.supabase
      .from("workouts")
      .insert({ owner_user_id: dbScope.ownerUserId, occurred_date: workoutDate })
      .select("id")
      .single();
    if (wkErr) throw new Error(wkErr.message);

    // Insert one row per set per exercise
    const setRows = exercises.flatMap((ex) =>
      ex.sets.map((s, si) => ({
        workout_id: wk.id,
        owner_user_id: dbScope.ownerUserId,
        exercise_name: ex.name,
        set_number: si + 1,
        reps: s.reps,
        weight_kg: s.weight_kg,
        notes: ex.notes ?? "",
      }))
    );
    if (setRows.length > 0) {
      const { error: exErr } = await dbScope.supabase.from("workout_exercises").insert(setRows);
      if (exErr) throw new Error(exErr.message);
    }

    const summary = exercises.map((e) => `${e.name} (${e.sets.length} sets)`).join(", ");
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
  const action = await parseInput(input, combinedNow);
  const message = await applyParsedAction(action, date, scope);
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
    return `I found *${f.name}* -> *${f.calories} cal*, *${f.protein_g}g protein*${est}, and *₹${s.amount}* spend${dateLabel}.\nNote it down? Reply *yes* or *no*.`;
  }

  if (type === "spending") {
    const entry = data as unknown as SpendEntry;
    const dateLabel = formatDateLabel(data.date as string);
    return `I parsed a spend${dateLabel}: *₹${entry.amount}* for *${entry.item}*.\nNote it down? Reply *yes* or *no*.`;
  }

  if (type === "multiple_spending") {
    const expenses = (data.expenses ?? []) as Array<{ item: string; amount: number; category?: string }>;
    const lines = expenses.map((e) => `*₹${e.amount}* for *${e.item}*`).join("\n");
    const dateLabel = formatDateLabel(data.date as string);
    return `I found ${expenses.length} expenses${dateLabel}:\n${lines}\nSave them? Reply *yes* or *no*.`;
  }

  if (type === "time_block") {
    const block = data as unknown as TimeBlock;
    const dateLabel = formatDateLabel(data.date as string);
    return `I parsed a time block${dateLabel}: *${block.start}-${block.end}* for *${block.activity}*.\nNote it down? Reply *yes* or *no*.`;
  }

  if (type === "time_blocks") {
    const blocks = (data.blocks ?? []) as Array<{ start: string; end: string; activity: string }>;
    const lines = blocks.map((b) => `*${b.start}–${b.end}* ${b.activity}`).join("\n");
    const dateLabel = formatDateLabel(data.date as string);
    return `I found ${blocks.length} time blocks${dateLabel}:\n${lines}\nSave them? Reply *yes* or *no*.`;
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
