import { NextResponse } from "next/server";
import { executeShortcutPlan, handleQueryInput, handleShortcutInput, handleWorkoutTitle } from "../../../lib/shortcut-service";
import { currentIstDate, currentIstIso, currentIstTime, isIsoDate, isLocalTime } from "../../../lib/time";
import { normalizeWorkoutCategory } from "../../../lib/workout-normalization";
import { planShortcutInput } from "../../../lib/opencode";
import { listSpendingCategories } from "../../../lib/spending-category-data";
import type { ShortcutQueryDomain, WorkoutExerciseInput } from "../../../lib/types";

export const maxDuration = 60;

function requestNow(body: Record<string, unknown>): string {
  if (typeof body.logged_at === "string" && !Number.isNaN(Date.parse(body.logged_at))) return body.logged_at;
  const date = isIsoDate(body.date) ? body.date : currentIstDate();
  const time = isLocalTime(body.now) ? body.now : currentIstTime();
  return `${date}T${time}:00+05:30`;
}

function amountValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  const numeric = Array.from(value).filter((character) => (character >= "0" && character <= "9") || character === ".").join("");
  return Number(numeric);
}

function queryDomain(value: unknown): ShortcutQueryDomain | undefined {
  return value === "spending" || value === "workout" || value === "tasks" ? value : undefined;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (body.action === "title_workout") {
      const sessionId = typeof body.session_id === "string" ? body.session_id : "";
      const title = typeof body.title === "string" ? body.title : "";
      if (!sessionId || !title.trim()) return NextResponse.json({ error: "session_id and title are required" }, { status: 400 });
      return NextResponse.json(await handleWorkoutTitle(sessionId, title));
    }

    if (body.action === "log_workout" && Array.isArray(body.exercises)) {
      const exercises = body.exercises as WorkoutExerciseInput[];
      const now = requestNow(body);
      const explicitCategory = normalizeWorkoutCategory(body.workout_category);
      const planned = explicitCategory
        ? null
        : await planShortcutInput(`Add this completed workout: ${JSON.stringify(exercises)}`, now);
      return NextResponse.json(await executeShortcutPlan({
        intent: "log_workout",
        exercises,
        workout_category: explicitCategory ?? planned?.workout_category,
        session_title: typeof body.title === "string" ? body.title : undefined,
        logged_at: now,
      }));
    }

    if (body.action === "log_task" && typeof body.title === "string") {
      return NextResponse.json(await executeShortcutPlan({
        intent: "log_task",
        tasks: [{
          title: body.title,
          due_at: typeof body.due_at === "string" ? body.due_at : undefined,
        }],
      }, requestNow(body)));
    }

    const rawAmount = amountValue(body.amount);
    if (Number.isFinite(rawAmount) && rawAmount > 0 && typeof body.item === "string") {
      const date = typeof body.date === "string" ? body.date : currentIstDate();
      const time = typeof body.now === "string" ? body.now : currentIstTime();
      const categories = await listSpendingCategories();
      const planned = await planShortcutInput(`I spent ${rawAmount} on ${body.item}`, requestNow(body), {
        spendingCategories: categories.map((category) => category.name),
      });
      return NextResponse.json(await executeShortcutPlan({
        intent: "log_spending",
        expenses: [{
          item: body.item,
          amount: rawAmount,
          category: typeof body.category === "string" ? body.category : planned.expenses?.[0]?.category ?? planned.spending_category,
          date,
          time,
        }],
      }, currentIstIso()));
    }

    const input = typeof body.input === "string" ? body.input.trim() : "";
    if (!input) return NextResponse.json({ error: "input is required" }, { status: 400 });
    const domain = queryDomain(body.query_only);
    const result = domain
      ? await handleQueryInput(input, domain, requestNow(body))
      : await handleShortcutInput(input, requestNow(body));
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message, message }, { status: 500 });
  }
}
