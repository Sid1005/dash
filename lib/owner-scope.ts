import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

export type DbScope = {
  supabase: SupabaseClient;
  ownerUserId: string;
};

const DEFAULT_OWNER_EMAIL = "siddharth.ceri@gmail.com";
const AUTH_BYPASS_ENABLED = process.env.DASH_AUTH_BYPASS !== "false";
let cachedDefaultOwnerId: string | null = null;

function unauthorized(): Error {
  const error = new Error("Unauthorized");
  error.name = "UnauthorizedError";
  return error;
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof Error && error.name === "UnauthorizedError";
}

async function getAuthenticatedUserScopedDb(): Promise<DbScope> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw unauthorized();
  }

  return { supabase: supabase as unknown as SupabaseClient, ownerUserId: user.id };
}

export async function getUserScopedDb(): Promise<DbScope> {
  if (AUTH_BYPASS_ENABLED) {
    return getDefaultOwnerDb();
  }

  return getAuthenticatedUserScopedDb();
}

export async function getDefaultOwnerId(): Promise<string> {
  if (cachedDefaultOwnerId) return cachedDefaultOwnerId;

  const envOwnerId = process.env.DEFAULT_OWNER_USER_ID?.trim();
  if (envOwnerId) {
    cachedDefaultOwnerId = envOwnerId;
    return cachedDefaultOwnerId;
  }

  const { data, error } = await createAdminClient().auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) throw new Error(error.message);

  const owner = data.users.find((user: User) => user.email === DEFAULT_OWNER_EMAIL);
  if (!owner) {
    throw new Error(`Default owner not found: ${DEFAULT_OWNER_EMAIL}`);
  }

  cachedDefaultOwnerId = owner.id;
  return cachedDefaultOwnerId;
}

export async function getDefaultOwnerDb(): Promise<DbScope> {
  return {
    supabase: createAdminClient() as unknown as SupabaseClient,
    ownerUserId: await getDefaultOwnerId(),
  };
}

export async function resolveDbScope(scope?: DbScope): Promise<DbScope> {
  return scope ?? getUserScopedDb();
}
