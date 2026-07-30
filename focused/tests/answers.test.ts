import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { formatTaskAnswer } from "@/lib/answers";
import type { TaskRow } from "@/lib/types";

const task: TaskRow = {
  id: "task-1",
  title: "Review dashboard",
  due_at: "2026-07-30T12:30:00.000Z",
  done: false,
  completed_at: null,
  created_at: "2026-07-30T10:00:00.000Z",
  updated_at: "2026-07-30T10:00:00.000Z",
};

describe("task query answers", () => {
  it("formats open tasks with their IST due time", () => {
    const answer = formatTaskAnswer([task], { status: "open" });

    expect(answer).toContain("Open tasks: 1");
    expect(answer).toContain("Review dashboard");
    expect(answer).toContain("18:00");
  });

  it("gives a clear empty result", () => {
    expect(formatTaskAnswer([], { status: "done" })).toBe("No done tasks were found.");
  });
});
