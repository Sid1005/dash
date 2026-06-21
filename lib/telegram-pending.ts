import fs from "fs/promises";
import path from "path";
import type { ParsedAction } from "@/lib/parse";
import { createAdminClient } from "@/lib/supabase/admin";

type PendingRecord = {
  action: ParsedAction;
  date: string;
  createdAt: number;
};

type PendingStore = Record<string, PendingRecord>;

const VAULT = process.env.VAULT_PATH ?? "";
const PENDING_FILE = VAULT
  ? path.join(VAULT, "Dashboard", ".telegram-pending.json")
  : path.join(process.cwd(), ".telegram-pending.json");
const TTL_MS = 15 * 60 * 1000;

function hasSupabaseConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY)
        ?.trim()
  );
}

async function readStoreFs(): Promise<PendingStore> {
  try {
    const raw = await fs.readFile(PENDING_FILE, "utf-8");
    const parsed = JSON.parse(raw) as PendingStore;
    return parsed ?? {};
  } catch {
    return {};
  }
}

async function writeStoreFs(store: PendingStore) {
  await fs.mkdir(path.dirname(PENDING_FILE), { recursive: true });
  await fs.writeFile(PENDING_FILE, JSON.stringify(store, null, 2), "utf-8");
}

function isFresh(record: PendingRecord): boolean {
  return Date.now() - record.createdAt < TTL_MS;
}

export async function setPending(chatId: number, action: ParsedAction, date: string) {
  if (hasSupabaseConfig()) {
    const supabase = createAdminClient();
    const { error } = await supabase.from("telegram_pending").upsert(
      {
        chat_id: chatId,
        action: action as unknown as Record<string, unknown>,
        date,
        created_at: new Date().toISOString(),
      },
      { onConflict: "chat_id" }
    );
    if (error) throw new Error(error.message);
    return;
  }

  const store = await readStoreFs();
  store[String(chatId)] = { action, date, createdAt: Date.now() };
  await writeStoreFs(store);
}

export async function getPending(chatId: number): Promise<PendingRecord | null> {
  if (hasSupabaseConfig()) {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("telegram_pending")
      .select("action, date, created_at")
      .eq("chat_id", chatId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const createdAt = new Date(data.created_at as string).getTime();
    if (Date.now() - createdAt >= TTL_MS) {
      await supabase.from("telegram_pending").delete().eq("chat_id", chatId);
      return null;
    }

    return {
      action: data.action as unknown as ParsedAction,
      date: data.date as string,
      createdAt,
    };
  }

  const store = await readStoreFs();
  const key = String(chatId);
  const record = store[key];
  if (!record) return null;
  if (!isFresh(record)) {
    delete store[key];
    await writeStoreFs(store);
    return null;
  }
  return record;
}

export async function clearPending(chatId: number) {
  if (hasSupabaseConfig()) {
    const supabase = createAdminClient();
    await supabase.from("telegram_pending").delete().eq("chat_id", chatId);
    return;
  }

  const store = await readStoreFs();
  const key = String(chatId);
  if (store[key]) {
    delete store[key];
    await writeStoreFs(store);
  }
}
