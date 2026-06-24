import { describe, expect, it } from "vitest";
import { isSpendCategory, matchSpendCategory, SPEND_CATEGORIES } from "../lib/spending";
import { formatINR } from "../lib/currency";

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

describe("INR formatting", () => {
  it("uses the rupee symbol and Indian digit grouping", () => {
    expect(formatINR(461)).toBe("₹461.00");
    expect(formatINR(1234567.5)).toBe("₹12,34,567.50");
  });

  it("supports whole-rupee dashboard totals", () => {
    expect(formatINR(971, 0)).toBe("₹971");
  });
});
