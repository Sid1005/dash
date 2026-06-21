import type { TaskRow } from "@/lib/tasks-types";

type ReminderEvent =
  | {
      event: "upsert";
      task_id: string;
      title: string;
      due_at: string;
    }
  | {
      event: "cancel";
      task_id: string;
    };

const WEBHOOK_TIMEOUT_MS = 4_000;

async function postHermesReminder(event: ReminderEvent): Promise<void> {
  const url = process.env.HERMES_REMINDER_WEBHOOK_URL?.trim();
  if (!url) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const secret = process.env.HERMES_REMINDER_WEBHOOK_SECRET?.trim();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (secret) headers.Authorization = `Bearer ${secret}`;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(event),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`[hermes-reminders] webhook failed: ${res.status} ${res.statusText}`);
    }
  } catch (error) {
    console.error("[hermes-reminders] webhook error:", error);
  } finally {
    clearTimeout(timeout);
  }
}

export async function notifyHermesTaskUpsert(
  task: Pick<TaskRow, "id" | "title" | "due_at" | "done">
): Promise<void> {
  if (task.done) {
    await notifyHermesTaskCancel(task.id);
    return;
  }

  await postHermesReminder({
    event: "upsert",
    task_id: task.id,
    title: task.title,
    due_at: task.due_at,
  });
}

export async function notifyHermesTaskCancel(taskId: string): Promise<void> {
  await postHermesReminder({
    event: "cancel",
    task_id: taskId,
  });
}
