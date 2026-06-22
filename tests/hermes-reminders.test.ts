import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyHermesTaskCancel, notifyHermesTaskUpsert } from "../lib/hermes-reminders";

describe("Hermes reminder delivery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("HERMES_REMINDER_WEBHOOK_URL", "https://hermes.example/dash/reminder");
    vi.stubEnv("HERMES_REMINDER_WEBHOOK_SECRET", "test-secret");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
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
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const delivery = notifyHermesTaskUpsert({
      id: "task-1",
      title: "Ship fix",
      due_at: "2026-06-23T06:30:00.000Z",
      done: false,
    });
    await vi.runAllTimersAsync();
    await delivery;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a server error but not an authentication error", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const delivery = notifyHermesTaskCancel("task-2");
    await vi.runAllTimersAsync();
    await delivery;
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await notifyHermesTaskCancel("task-2");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends the shared secret and cancellation payload", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await notifyHermesTaskCancel("task-3");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://hermes.example/dash/reminder",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event: "cancel", task_id: "task-3" }),
      })
    );
  });
});
