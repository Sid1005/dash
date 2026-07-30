import { SPENDING_CATEGORIES, type ShortcutQueryDomain } from "@/lib/types";

export function buildShortcutSystemPrompt(now: string, options: {
  spendingCategories?: string[];
  queryOnly?: ShortcutQueryDomain;
} = {}): string {
  const categories = options.spendingCategories?.length ? options.spendingCategories : [...SPENDING_CATEGORIES];
  const modeRule = options.queryOnly
    ? `- This request comes from the ${options.queryOnly} query box. It is read-only. Return only query_${options.queryOnly} or unknown; never return an intent that changes data.`
    : "- This request may either query existing data or add new data. Choose the single matching intent.";
  return `You route a private personal dashboard request into exactly one JSON action.
Current date and time in Asia/Kolkata: ${now}

Allowed intents: query_workout, query_spending, query_tasks, log_workout, log_spending, log_task, unknown.

Return a JSON object using only relevant fields:
{
  "intent": "...",
  "workout_category": "Chest|Back|Shoulders|Leg|Bicep",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "latest": true,
  "task_status": "open|done|all",
  "logged_at": "ISO-8601 with +05:30 for a historical workout log",
  "spending_category": "an existing spending category, or a concise new category when adding spending",
  "session_title": "optional user-supplied title",
  "exercises": [{"name":"...","sets":[{"reps":0,"weight_kg":0,"notes":""}]}],
  "expenses": [{"item":"...","amount":0,"category":"...","date":"YYYY-MM-DD","time":"HH:MM"}],
  "tasks": [{"title":"...","due_at":"ISO-8601 with +05:30 when a due time is known"}]
}

Rules:
${modeRule}
- A terse phrase such as "last bicep workout" is query_workout, never a log.
- Workout queries refer to whole sessions. Map biceps, triceps, curls, or arms to Bicep; legs to Leg.
- "week of 23rd to 30th June" is an inclusive date range in the most recent sensible year. Resolve all dates.
- If a workout query has no date, set latest true. Never infer a match from an exercise name; workout_category is the session filter.
- A workout log contains exercises the user completed. Keep one exercise object per named movement and every stated set. Bare numbers without a weight unit are reps. Missing reps or weight become 0.
- For a workout log stated as today/yesterday/on a date, set logged_at. Otherwise omit it so the server uses the actual request time.
- A spending query asks how much/where/what was spent. Resolve its inclusive date range; with no range use the current calendar month.
- A task query asks what is due, open, completed, or scheduled. Use query_tasks, resolve any inclusive date range, and set task_status. With no status, use open.
- For "latest task", set latest true. Do not invent a date range when the user asks for all open tasks.
- Existing spending categories: ${categories.join(", ")}.
- When adding spending, choose the closest existing category. Create a short title-case category only when none truthfully fits.
- When querying spending by category, return the matching existing category exactly as written.
- Use Family for transfers/support to relatives.
- A task log is something the user intends to do. If no due time is stated, omit due_at.
- Do not create food logs, calendar events, tickets, notes, or Telegram actions; return unknown for those.`;
}
