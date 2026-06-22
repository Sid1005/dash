import { describe, expect, it } from "vitest";
import { fallbackDateRange } from "../lib/date-range";

describe("fallbackDateRange", () => {
  it("resolves yesterday without crossing the IST/UTC boundary", () => {
    expect(fallbackDateRange("what did I eat yesterday?", "2026-06-15")).toEqual({
      startDate: "2026-06-14",
      endDate: "2026-06-14",
    });
  });

  it("uses Monday through Sunday for last week", () => {
    expect(fallbackDateRange("show last week", "2026-06-15")).toEqual({
      startDate: "2026-06-08",
      endDate: "2026-06-14",
    });
  });

  it("handles month and year boundaries", () => {
    expect(fallbackDateRange("show last month", "2026-01-10")).toEqual({
      startDate: "2025-12-01",
      endDate: "2025-12-31",
    });
    expect(fallbackDateRange("show this month", "2026-06-15")).toEqual({
      startDate: "2026-06-01",
      endDate: "2026-06-15",
    });
  });

  it("defaults to an inclusive trailing 31-day window", () => {
    expect(fallbackDateRange("show my spending", "2026-03-01")).toEqual({
      startDate: "2026-01-30",
      endDate: "2026-03-01",
    });
  });
});
