import { describe, expect, it } from "vitest";
import {
  hasStandaloneCalendarEventHint,
  normalizeStandaloneCalendarInput,
} from "../lib/calendar-input";

describe("calendar input normalization", () => {
  it("uses the later meridiem for partial time ranges", () => {
    expect(normalizeStandaloneCalendarInput("Recommendation 7:45 to 8pm")).toBe(
      "Recommendation 7:45pm to 8pm"
    );
  });

  it("leaves complete meridiems untouched", () => {
    expect(normalizeStandaloneCalendarInput("Recommendation 7:45pm to 8pm")).toBe(
      "Recommendation 7:45pm to 8pm"
    );
  });

  it("recognizes explicit time ranges as event hints", () => {
    expect(hasStandaloneCalendarEventHint("Recommendation 7:45 to 8pm")).toBe(true);
    expect(hasStandaloneCalendarEventHint("Lunch with Priya")).toBe(false);
  });
});
