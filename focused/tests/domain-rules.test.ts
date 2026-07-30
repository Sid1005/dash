import { describe, expect, it } from "vitest";
import { cleanSpendingCategory, findSpendingCategory } from "../lib/spending-categories";
import { normalizeWorkoutCategory } from "../lib/workout-normalization";

describe("domain value normalization", () => {
  it("accepts canonical workout categories without semantic guessing", () => {
    expect(normalizeWorkoutCategory("Bicep")).toBe("Bicep");
    expect(normalizeWorkoutCategory(" shoulders ")).toBe("Shoulders");
    expect(normalizeWorkoutCategory("arms")).toBeUndefined();
  });

  it("matches user-managed spending categories by name", () => {
    const categories = ["Food", "Family", "Rail Travel"];
    expect(findSpendingCategory("rail travel", categories)).toBe("Rail Travel");
    expect(cleanSpendingCategory("  New   Category  ")).toBe("New Category");
  });
});
