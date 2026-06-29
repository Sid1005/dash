export function isAuthBypassEnabled() {
  return process.env.DASH_AUTH_BYPASS === "true";
}
