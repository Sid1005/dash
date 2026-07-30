import { beforeEach, describe, expect, it, vi } from "vitest";

const { createCompletion } = vi.hoisted(() => ({
  createCompletion: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: createCompletion } };
  },
}));

import { OPENCODE_MODEL, planShortcutInput } from "@/lib/opencode";

describe("OpenCode shortcut routing", () => {
  beforeEach(() => {
    process.env.OPENCODE_API_KEY = "test-key";
    createCompletion.mockReset();
  });

  it("sends a terse workout query to DeepSeek instead of using a local shortcut", async () => {
    createCompletion.mockResolvedValue({
      choices: [{ message: { content: '{"intent":"query_workout","workout_category":"Bicep","latest":true}' } }],
    });

    await expect(planShortcutInput("last bicep workout", "2026-07-22T12:00:00+05:30")).resolves.toEqual({
      intent: "query_workout",
      workout_category: "Bicep",
      latest: true,
    });

    expect(createCompletion).toHaveBeenCalledOnce();
    expect(createCompletion).toHaveBeenCalledWith(expect.objectContaining({
      model: OPENCODE_MODEL,
      messages: expect.arrayContaining([
        { role: "user", content: "last bicep workout" },
      ]),
    }));
  });

  it("retries DeepSeek once when the provider returns an empty completion", async () => {
    createCompletion
      .mockResolvedValueOnce({ choices: [{ message: { content: "" } }] })
      .mockResolvedValueOnce({
        choices: [{ message: { content: '{"intent":"query_workout","workout_category":"Bicep","latest":true}' } }],
      });

    await expect(planShortcutInput("last bicep workout", "2026-07-22T12:00:00+05:30")).resolves.toMatchObject({
      intent: "query_workout",
    });
    expect(createCompletion).toHaveBeenCalledTimes(2);
  });

  it("normalizes task query status and dates", async () => {
    createCompletion.mockResolvedValue({
      choices: [{ message: { content: '{"intent":"query_tasks","task_status":"done","start_date":"2026-06-01","end_date":"2026-06-30"}' } }],
    });

    await expect(planShortcutInput("completed tasks in June", "2026-07-22T12:00:00+05:30", {
      queryOnly: "tasks",
    })).resolves.toEqual({
      intent: "query_tasks",
      task_status: "done",
      start_date: "2026-06-01",
      end_date: "2026-06-30",
    });
  });
});
