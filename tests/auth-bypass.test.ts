import { afterEach, describe, expect, it } from "vitest";
import { isAuthBypassEnabled } from "../lib/auth-bypass";

const ORIGINAL_VALUE = process.env.DASH_AUTH_BYPASS;

afterEach(() => {
  if (ORIGINAL_VALUE === undefined) {
    delete process.env.DASH_AUTH_BYPASS;
    return;
  }

  process.env.DASH_AUTH_BYPASS = ORIGINAL_VALUE;
});

describe("isAuthBypassEnabled", () => {
  it("defaults to false when the env var is unset", () => {
    delete process.env.DASH_AUTH_BYPASS;
    expect(isAuthBypassEnabled()).toBe(false);
  });

  it("enables bypass only for the explicit true value", () => {
    process.env.DASH_AUTH_BYPASS = "true";
    expect(isAuthBypassEnabled()).toBe(true);
  });

  it("keeps bypass disabled for false", () => {
    process.env.DASH_AUTH_BYPASS = "false";
    expect(isAuthBypassEnabled()).toBe(false);
  });
});
