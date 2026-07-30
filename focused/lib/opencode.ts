import "server-only";
import OpenAI from "openai";
import { currentIstIso, isIsoDate, isLocalTime } from "@/lib/time";
import { type ShortcutPlan, type ShortcutIntent, type ShortcutQueryDomain } from "@/lib/types";
import { cleanSpendingCategory, findSpendingCategory } from "@/lib/spending-categories";
import { normalizeWorkoutCategory } from "@/lib/workout-normalization";
import { buildShortcutSystemPrompt } from "@/lib/shortcut-prompt";

export const OPENCODE_MODEL = "deepseek-v4-flash";
export const OPENCODE_BASE_URL = "https://opencode.ai/zen/go/v1";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENCODE_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENCODE_API_KEY is not configured.");
  client = new OpenAI({ apiKey, baseURL: OPENCODE_BASE_URL });
  return client;
}

const INTENTS: ShortcutIntent[] = [
  "query_workout",
  "query_spending",
  "query_tasks",
  "log_workout",
  "log_spending",
  "log_task",
  "unknown",
];

function cleanPlan(raw: Record<string, unknown>, spendingCategories: string[]): ShortcutPlan {
  const intent = INTENTS.includes(raw.intent as ShortcutIntent)
    ? (raw.intent as ShortcutIntent)
    : "unknown";
  const plan: ShortcutPlan = { intent };
  const category = normalizeWorkoutCategory(raw.workout_category);
  if (category) plan.workout_category = category;
  if (isIsoDate(raw.start_date)) plan.start_date = raw.start_date;
  if (isIsoDate(raw.end_date)) plan.end_date = raw.end_date;
  if (typeof raw.latest === "boolean") plan.latest = raw.latest;
  if (raw.task_status === "open" || raw.task_status === "done" || raw.task_status === "all") {
    plan.task_status = raw.task_status;
  }
  if (typeof raw.logged_at === "string" && !Number.isNaN(Date.parse(raw.logged_at))) {
    plan.logged_at = raw.logged_at;
  }
  const requestedCategory = findSpendingCategory(raw.spending_category, spendingCategories)
    ?? cleanSpendingCategory(raw.spending_category);
  if (requestedCategory) plan.spending_category = requestedCategory;
  if (typeof raw.session_title === "string" && raw.session_title.trim()) {
    plan.session_title = raw.session_title.trim().slice(0, 120);
  }

  if (Array.isArray(raw.exercises)) {
    plan.exercises = raw.exercises.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const row = entry as Record<string, unknown>;
      if (typeof row.name !== "string" || !row.name.trim()) return [];
      const sets = Array.isArray(row.sets)
        ? row.sets.flatMap((set) => {
            if (!set || typeof set !== "object") return [];
            const value = set as Record<string, unknown>;
            return [{
              reps: typeof value.reps === "number" ? value.reps : 0,
              weight_kg: typeof value.weight_kg === "number" ? value.weight_kg : 0,
              notes: typeof value.notes === "string" ? value.notes : "",
            }];
          })
        : [];
      return [{ name: row.name.trim(), sets }];
    });
  }

  if (Array.isArray(raw.expenses)) {
    plan.expenses = raw.expenses.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const row = entry as Record<string, unknown>;
      if (typeof row.item !== "string" || typeof row.amount !== "number" || row.amount <= 0) return [];
      return [{
        item: row.item.trim().slice(0, 200),
        amount: row.amount,
        category: findSpendingCategory(row.category, spendingCategories) ?? cleanSpendingCategory(row.category),
        date: isIsoDate(row.date) ? row.date : undefined,
        time: isLocalTime(row.time) ? row.time : undefined,
      }];
    });
  }

  if (Array.isArray(raw.tasks)) {
    plan.tasks = raw.tasks.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const row = entry as Record<string, unknown>;
      if (typeof row.title !== "string" || !row.title.trim()) return [];
      const dueAt = typeof row.due_at === "string" && !Number.isNaN(Date.parse(row.due_at))
        ? row.due_at
        : undefined;
      return [{ title: row.title.trim().slice(0, 2000), due_at: dueAt }];
    });
  }
  return plan;
}

export async function planShortcutInput(input: string, now = currentIstIso(), options: {
  spendingCategories?: string[];
  queryOnly?: ShortcutQueryDomain;
} = {}): Promise<ShortcutPlan> {
  let lastError: Error | null = null;
  const spendingCategories = options.spendingCategories ?? [];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await getClient().chat.completions.create({
      model: OPENCODE_MODEL,
      temperature: 0,
      max_tokens: 4500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildShortcutSystemPrompt(now, options),
        },
        { role: "user", content: input },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      lastError = new Error("OpenCode returned no routing result.");
      continue;
    }

    try {
      return cleanPlan(JSON.parse(content) as Record<string, unknown>, spendingCategories);
    } catch {
      lastError = new Error("OpenCode returned an invalid routing result.");
    }
  }

  throw lastError ?? new Error("OpenCode could not route this request.");
}
