import "server-only";
import { after } from "next/server";
import { formatSpendingAnswer, formatTaskAnswer, formatWorkoutAnswer } from "./answers";
import { notifyHermesTaskUpsert } from "./hermes-reminders";
import { formatINR } from "./money";
import { planShortcutInput } from "./opencode";
import { insertSpending, listSpending } from "./spending-data";
import { ensureSpendingCategory, listSpendingCategories } from "./spending-category-data";
import { insertTask, listTasks } from "./tasks-data";
import { currentIstDate, currentIstIso, currentIstTime, endOfIstDayIso } from "./time";
import type { ShortcutPlan, ShortcutQueryDomain, ShortcutResponse } from "./types";
import { appendWorkoutLog, listWorkoutSessions, titleWorkoutSession } from "./workouts-data";

function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export async function executeShortcutPlan(plan: ShortcutPlan, now = currentIstIso()): Promise<ShortcutResponse> {
  const today = currentIstDate(new Date(now));
  const time = currentIstTime(new Date(now));

  if (plan.intent === "query_workout") {
    const sessions = await listWorkoutSessions({
      category: plan.workout_category,
      startDate: plan.start_date,
      endDate: plan.end_date,
      limit: plan.latest ? 1 : 20,
    });
    return {
      ok: true,
      intent: plan.intent,
      message: formatWorkoutAnswer(sessions, {
        category: plan.workout_category,
        startDate: plan.start_date,
        endDate: plan.end_date,
        latest: plan.latest,
      }),
      data: { sessions },
    };
  }

  if (plan.intent === "query_spending") {
    const startDate = plan.start_date ?? startOfMonth(today);
    const endDate = plan.end_date ?? today;
    const rows = await listSpending({ startDate, endDate, category: plan.spending_category });
    return {
      ok: true,
      intent: plan.intent,
      message: formatSpendingAnswer(rows, { startDate, endDate, category: plan.spending_category }),
      data: { rows, start_date: startDate, end_date: endDate },
    };
  }

  if (plan.intent === "query_tasks") {
    const status = plan.task_status ?? "open";
    const tasks = await listTasks({
      startDate: plan.start_date,
      endDate: plan.end_date,
      status,
      limit: 100,
    });
    return {
      ok: true,
      intent: plan.intent,
      message: formatTaskAnswer(tasks, {
        startDate: plan.start_date,
        endDate: plan.end_date,
        status,
        latest: plan.latest,
      }),
      data: { tasks },
    };
  }

  if (plan.intent === "log_workout") {
    if (!plan.exercises?.length) throw new Error("I could not find any exercises to log.");
    if (!plan.workout_category) throw new Error("I could not determine the workout category.");
    const result = await appendWorkoutLog({
      exercises: plan.exercises,
      loggedAt: plan.logged_at ?? now,
      category: plan.workout_category,
      title: plan.session_title,
    });
    const exerciseNames = Array.from(new Set(plan.exercises.map((exercise) => exercise.name))).join(", ");
    const message = `${result.created ? "Started" : "Updated"} ${result.session.session_category} session: ${exerciseNames}.`;
    return {
      ok: true,
      intent: plan.intent,
      message,
      needs_follow_up: result.needsTitle,
      follow_up: result.needsTitle
        ? {
            type: "workout_title",
            prompt: "What should I call this workout?",
            session_id: result.session.id,
          }
        : undefined,
      data: { session: result.session },
    };
  }

  if (plan.intent === "log_spending") {
    if (!plan.expenses?.length) throw new Error("I could not find a spending item and amount.");
    const rows = [];
    for (const expense of plan.expenses) {
      const category = await ensureSpendingCategory(expense.category ?? plan.spending_category ?? "Other");
      rows.push(await insertSpending({
        item: expense.item,
        amount: expense.amount,
        category,
        date: expense.date ?? today,
        time: expense.time ?? time,
      }));
    }
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    return {
      ok: true,
      intent: plan.intent,
      message: `Added ${rows.length} ${rows.length === 1 ? "spend" : "spends"} totalling ${formatINR(total)}: ${rows.map((row) => `${row.item} (${row.category})`).join(", ")}.`,
      data: { rows },
    };
  }

  if (plan.intent === "log_task") {
    if (!plan.tasks?.length) throw new Error("I could not find a task to log.");
    const tasks = [];
    for (const task of plan.tasks) {
      const created = await insertTask(task.title, task.due_at ?? endOfIstDayIso(today));
      tasks.push(created);
      after(() => notifyHermesTaskUpsert(created));
    }
    return {
      ok: true,
      intent: plan.intent,
      message: `Added ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}: ${tasks.map((task) => task.title).join(", ")}.`,
      data: { tasks },
    };
  }

  return {
    ok: false,
    intent: "unknown",
    message: "I can add spending, workouts, or tasks, and query all three.",
  };
}

export async function handleShortcutInput(input: string, now = currentIstIso()): Promise<ShortcutResponse> {
  const categories = await listSpendingCategories();
  const plan = await planShortcutInput(input, now, { spendingCategories: categories.map((category) => category.name) });
  return executeShortcutPlan(plan, now);
}

export async function handleQueryInput(input: string, domain: ShortcutQueryDomain, now = currentIstIso()): Promise<ShortcutResponse> {
  const categories = await listSpendingCategories();
  const plan = await planShortcutInput(input, now, {
    spendingCategories: categories.map((category) => category.name),
    queryOnly: domain,
  });
  const expectedIntent = domain === "spending"
    ? "query_spending"
    : domain === "workout"
      ? "query_workout"
      : "query_tasks";
  if (plan.intent !== expectedIntent) {
    return { ok: false, intent: "unknown", message: `Use this box to query past ${domain}.` };
  }
  return executeShortcutPlan(plan, now);
}

export async function handleWorkoutTitle(sessionId: string, title: string): Promise<ShortcutResponse> {
  const session = await titleWorkoutSession(sessionId, title);
  return {
    ok: true,
    intent: "title_workout",
    message: `Workout titled “${session.title}”. Anything added within three hours will stay in this session.`,
    data: { session },
  };
}
