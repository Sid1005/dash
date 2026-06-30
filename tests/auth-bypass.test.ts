import { describe, expect, it } from "vitest";
import { isAuthBypassEnabled } from "../lib/auth-bypass";

describe("isAuthBypassEnabled", () => {
  it("keeps bypass enabled without env configuration", () => {
    delete process.env.DASH_AUTH_BYPASS;
    expect(isAuthBypassEnabled()).toBe(true);
  });

  it("ignores an explicit false env value", () => {
    process.env.DASH_AUTH_BYPASS = "false";
    expect(isAuthBypassEnabled()).toBe(true);
  });
});
