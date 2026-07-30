import { describe, expect, it } from "vitest";
import { buildShortcutSystemPrompt } from "../lib/shortcut-prompt";

describe("DeepSeek shortcut system prompt", () => {
  it("routes terse workout questions through the model with session semantics", () => {
    const prompt = buildShortcutSystemPrompt("2026-07-22T12:00:00+05:30");

    expect(prompt).toContain('A terse phrase such as "last bicep workout" is query_workout');
    expect(prompt).toContain("Workout queries refer to whole sessions");
    expect(prompt).toContain("workout_category is the session filter");
    expect(prompt).toContain("Current date and time in Asia/Kolkata: 2026-07-22T12:00:00+05:30");
  });

  it("makes the page query boxes read-only and supplies current categories", () => {
    const prompt = buildShortcutSystemPrompt("2026-07-22T12:00:00+05:30", {
      queryOnly: "spending",
      spendingCategories: ["Food", "Family", "Rail Travel"],
    });

    expect(prompt).toContain("It is read-only. Return only query_spending or unknown");
    expect(prompt).toContain("Existing spending categories: Food, Family, Rail Travel");
  });

  it("supports a read-only task query box", () => {
    const prompt = buildShortcutSystemPrompt("2026-07-22T12:00:00+05:30", {
      queryOnly: "tasks",
    });

    expect(prompt).toContain("Return only query_tasks or unknown");
    expect(prompt).toContain("A task query asks what is due, open, completed, or scheduled");
  });
});
