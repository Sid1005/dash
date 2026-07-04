import { describe, expect, it } from "vitest";
import { splitTelegramMessage } from "../lib/telegram";

describe("splitTelegramMessage", () => {
  it("keeps short messages unchanged", () => {
    expect(splitTelegramMessage("hello")).toEqual(["hello"]);
  });

  it("splits long replies under the Telegram chunk limit", () => {
    const line = "Set 1: 12 reps @ 10 kg\n";
    const message = line.repeat(250);
    const chunks = splitTelegramMessage(message, 500);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 500)).toBe(true);
    expect(chunks.join("\n")).toContain("Set 1: 12 reps @ 10 kg");
  });
});
