import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyHermesTaskCancel, notifyHermesTaskUpsert, notifyHermesEventUpsert, notifyHermesEventCancel } from "../lib/hermes-reminders";

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

  it("sends an event upsert with ISO start_at in IST", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await notifyHermesEventUpsert({
      id: "event-1",
      date: "2026-06-27",
      start: "09:30",
      activity: "Team standup",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://hermes.example/dash/reminder",
      expect.objectContaining({
        body: JSON.stringify({
          event: "upsert",
          event_id: "event-1",
          title: "Team standup",
          start_at: "2026-06-27T09:30:00+05:30",
        }),
      })
    );
  });

  it("sends an event cancel with event_id", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await notifyHermesEventCancel("event-2");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://hermes.example/dash/reminder",
      expect.objectContaining({
        body: JSON.stringify({ event: "cancel", event_id: "event-2" }),
      })
    );
  });

  it("skips event upsert when webhook URL is not set", async () => {
    vi.stubEnv("HERMES_REMINDER_WEBHOOK_URL", "");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await notifyHermesEventUpsert({
      id: "event-3",
      date: "2026-06-27",
      start: "10:00",
      activity: "Focus block",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
