import { describe, expect, it } from "vitest";
import { isSpendCategory, matchSpendCategory, SPEND_CATEGORIES } from "../lib/spending";

describe("spending categories", () => {
  it("keeps one canonical list", () => {
    expect(SPEND_CATEGORIES).toEqual([
      "Food",
      "Transport",
      "Health",
      "Entertainment",
      "Shopping",
      "Other",
    ]);
  });

  it("matches structured input case-insensitively", () => {
    expect(matchSpendCategory("  entertainment ")).toBe("Entertainment");
    expect(matchSpendCategory("unknown")).toBe("Other");
    expect(matchSpendCategory(null)).toBe("Other");
  });

  it("narrows canonical category strings", () => {
    expect(isSpendCategory("Food")).toBe(true);
    expect(isSpendCategory("food")).toBe(false);
  });
});
