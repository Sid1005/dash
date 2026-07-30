import { formatINR } from "@/lib/money";
import { formatDateLong, formatDateRange } from "@/lib/time";
import type { SpendingRow, TaskRow, WorkoutSession } from "@/lib/types";
import { groupWorkoutExercises } from "@/lib/workouts-data";

function setLabel(reps: number, weight: number): string {
  if (reps > 0 && weight > 0) return `${reps} × ${weight} kg`;
  if (reps > 0) return `${reps} reps`;
  if (weight > 0) return `${weight} kg`;
  return "recorded";
}

export function formatWorkoutAnswer(
  sessions: WorkoutSession[],
  options: { category?: string; startDate?: string; endDate?: string; latest?: boolean }
): string {
  if (sessions.length === 0) {
    const category = options.category ? `${options.category} ` : "";
    const range = options.startDate && options.endDate ? ` in ${formatDateRange(options.startDate, options.endDate)}` : "";
    return `No ${category}workout session was found${range}.`;
  }

  const details = sessions.map((session) => {
    const exercises = groupWorkoutExercises(session.workout_exercises)
      .map((exercise) => `• ${exercise.name}: ${exercise.sets.map((set) => setLabel(set.reps, set.weight_kg)).join(", ")}`)
      .join("\n");
    const title = session.title === session.session_category
      ? session.session_category
      : `${session.session_category} · ${session.title}`;
    return `${formatDateLong(session.occurred_date)} — ${title}\n${exercises}`;
  });

  if (options.latest && sessions.length === 1) {
    return `Last ${sessions[0].session_category} workout\n${details[0]}`;
  }
  const range = options.startDate && options.endDate
    ? ` in ${formatDateRange(options.startDate, options.endDate)}`
    : "";
  return `${options.category ?? "Workout"} sessions${range}: ${sessions.length}\n\n${details.join("\n\n")}`;
}

export function formatSpendingAnswer(
  rows: SpendingRow[],
  options: { startDate: string; endDate: string; category?: string }
): string {
  const range = formatDateRange(options.startDate, options.endDate);
  if (rows.length === 0) {
    return `No ${options.category ? `${options.category.toLowerCase()} ` : ""}spending was found for ${range}.`;
  }
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.category, (totals.get(row.category) ?? 0) + row.amount);
  const categoryLines = Array.from(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => `• ${category}: ${formatINR(amount)}`)
    .join("\n");
  const recent = rows.slice(0, 5).map((row) => `• ${row.item}: ${formatINR(row.amount)} (${row.category})`).join("\n");
  return `${range}\n${formatINR(total)} across ${rows.length} ${rows.length === 1 ? "spend" : "spends"}\n\nBy category\n${categoryLines}\n\nRecent\n${recent}`;
}

export function formatTaskAnswer(
  tasks: TaskRow[],
  options: { startDate?: string; endDate?: string; status: "open" | "done" | "all"; latest?: boolean }
): string {
  const range = options.startDate && options.endDate
    ? ` for ${formatDateRange(options.startDate, options.endDate)}`
    : "";
  if (tasks.length === 0) {
    return `No ${options.status === "all" ? "" : `${options.status} `}tasks were found${range}.`;
  }

  const selected = options.latest ? tasks.slice(-1) : tasks;
  const lines = selected.map((task) => {
    const date = new Date(task.due_at);
    const dueDate = date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const dueTime = date.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    return `• ${task.done ? "✓" : "○"} ${task.title} — ${formatDateLong(dueDate)}, ${dueTime}`;
  });
  const heading = options.latest ? "Latest task" : `${options.status === "all" ? "All" : options.status === "done" ? "Completed" : "Open"} tasks`;
  return `${heading}${range}: ${selected.length}\n${lines.join("\n")}`;
}
