import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabase/admin";

export type DbScope = { supabase: SupabaseClient; ownerUserId: string };

const DEFAULT_OWNER_EMAIL = "siddharth.ceri@gmail.com";
let cachedOwnerId: string | null = null;

export async function getOwnerId(): Promise<string> {
  if (cachedOwnerId) return cachedOwnerId;
  const configured = process.env.DEFAULT_OWNER_USER_ID?.trim();
  if (configured) {
    cachedOwnerId = configured;
    return configured;
  }

  const { data, error } = await getAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);
  const owner = data.users.find((user: User) => user.email === DEFAULT_OWNER_EMAIL);
  if (!owner) throw new Error(`Default owner not found: ${DEFAULT_OWNER_EMAIL}`);
  cachedOwnerId = owner.id;
  return owner.id;
}

export async function getOwnerScope(): Promise<DbScope> {
  return { supabase: getAdminClient(), ownerUserId: await getOwnerId() };
}
