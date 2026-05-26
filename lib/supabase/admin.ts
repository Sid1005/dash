import { createClient } from "@supabase/supabase-js";

/**
 * Server-only client with secret key (service_role / legacy service secret).
 * Bypasses RLS — use only in Route Handlers, Server Actions, webhooks.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    ""
  ).trim();

  if (!url) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL in .env.local (Supabase → Settings → API → Project URL)."
    );
  }
  if (!secret) {
    throw new Error(
      "Set SUPABASE_SERVICE_ROLE_KEY in .env.local to the secret/service key — not the publishable key. Supabase → Settings → API → Secret keys (legacy: service_role JWT). The line must have a value after = with no quotes unless the key itself contains spaces."
    );
  }

  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
