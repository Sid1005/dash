import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyHermesTaskCancel, notifyHermesTaskUpsert } from "../lib/hermes-reminders";

describe("Hermes reminder delivery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("HERMES_REMINDER_WEBHOOK_URL", "https://hermes.example/dash/reminder");
    vi.stubEnv("HERMES_REMINDER_WEBHOOK_SECRET", "test-secret");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("retries a transient network failure", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockResolvedValueOnce(new Response('{"ok":true,"job_id":"job-1"}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const delivery = notifyHermesTaskUpsert({
      id: "task-1",
      title: "Ship fix",
      due_at: "2026-08-01T06:30:00.000Z",
      done: false,
    });
    await vi.runAllTimersAsync();
    await delivery;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(console.info).toHaveBeenCalledWith(
      "[hermes-reminders] upsert delivered",
      { taskId: "task-1", jobId: "job-1" }
    );
  });

  it("sends the secret and cancellation payload", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await notifyHermesTaskCancel("task-2");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://hermes.example/dash/reminder",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event: "cancel", task_id: "task-2" }),
      })
    );
  });

  it("normalizes Supabase fractional timestamps for the Hermes VM", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await notifyHermesTaskUpsert({
      id: "task-fraction",
      title: "Canonical time",
      due_at: "2026-07-30T06:42:32.9+00:00",
      done: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://hermes.example/dash/reminder",
      expect.objectContaining({
        body: JSON.stringify({
          event: "upsert",
          task_id: "task-fraction",
          title: "Canonical time",
          due_at: "2026-07-30T06:42:32.900Z",
        }),
      })
    );
  });

  it("cancels completed tasks instead of scheduling them", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await notifyHermesTaskUpsert({
      id: "task-3",
      title: "Already done",
      due_at: "2026-08-01T06:30:00.000Z",
      done: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://hermes.example/dash/reminder",
      expect.objectContaining({
        body: JSON.stringify({ event: "cancel", task_id: "task-3" }),
      })
    );
  });

  it("reports a missing webhook instead of making a request", async () => {
    vi.stubEnv("HERMES_REMINDER_WEBHOOK_URL", "");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await notifyHermesTaskCancel("task-4");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      "[hermes-reminders] cancel skipped: webhook URL is not configured"
    );
  });
});
