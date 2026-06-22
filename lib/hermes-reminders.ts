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
const WEBHOOK_MAX_ATTEMPTS = 3;
const WEBHOOK_RETRY_BASE_DELAY_MS = 250;

function retryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postHermesReminder(event: ReminderEvent): Promise<void> {
  const url = process.env.HERMES_REMINDER_WEBHOOK_URL?.trim();
  if (!url) return;

  const secret = process.env.HERMES_REMINDER_WEBHOOK_SECRET?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) headers.Authorization = `Bearer ${secret}`;

  for (let attempt = 1; attempt <= WEBHOOK_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(event),
        signal: controller.signal,
      });

      if (res.ok) return;

      const canRetry = retryableStatus(res.status) && attempt < WEBHOOK_MAX_ATTEMPTS;
      if (!canRetry) {
        console.error(
          `[hermes-reminders] webhook failed after ${attempt} attempt(s): ${res.status} ${res.statusText}`
        );
        return;
      }
    } catch (error) {
      if (attempt === WEBHOOK_MAX_ATTEMPTS) {
        console.error(
          `[hermes-reminders] webhook failed after ${attempt} attempts:`,
          error
        );
        return;
      }
    } finally {
      clearTimeout(timeout);
    }

    await wait(WEBHOOK_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
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
