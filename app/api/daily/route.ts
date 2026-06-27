import { after, NextRequest, NextResponse } from "next/server";
import { type FoodEntry } from "@/lib/types";
import {
  deleteFoodEntry,
  insertFoodEntry,
  listFoodEntriesForDate,
} from "@/lib/food-supabase";
import {
  deleteTimeBlock,
  insertTimeBlock,
  listTimeBlocksForDate,
} from "@/lib/time-blocks-supabase";
import {
  deleteSpending,
  insertSpending,
  listSpendingForDate,
} from "@/lib/spending-supabase";
import { currentIstDate } from "@/lib/time";
import { getUserScopedDb } from "@/lib/owner-scope";
import { notifyHermesEventUpsert, notifyHermesEventCancel } from "@/lib/hermes-reminders";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? currentIstDate();
  const scope = await getUserScopedDb();
  const [food, time_blocks, spending] = await Promise.all([
    listFoodEntriesForDate(date, scope),
    listTimeBlocksForDate(date, scope),
    listSpendingForDate(date, scope),
  ]);
  const spendingMapped = spending.map((s) => ({
    id: s.id,
    item: s.item,
    amount: Number(s.amount),
    category: s.category,
    time: s.time_local,
  }));
  return NextResponse.json({ date, food, time_blocks, spending: spendingMapped });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, type, data } = body;
  const d = date ?? currentIstDate();
  const scope = await getUserScopedDb();

  if (type === "food") {
    const row = await insertFoodEntry(d, data as FoodEntry, scope);
    return NextResponse.json({ ok: true, food: row });
  }
  if (type === "spending") {
    const row = await insertSpending(d, data as { item: string; amount: number; category: string; time: string }, scope);
    return NextResponse.json({ ok: true, spending: row });
  }
  if (type === "time_block") {
    const block = await insertTimeBlock(d, data, scope);
    after(() => notifyHermesEventUpsert(block));
    return NextResponse.json({ ok: true, time_block: block });
  }
  return NextResponse.json({ error: "unknown type" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { type, id } = body;
  const scope = await getUserScopedDb();

  if (type === "food") {
    const foodId = typeof id === "string" ? id.trim() : "";
    if (!foodId) {
      return NextResponse.json(
        { error: "food delete requires id (uuid)" },
        { status: 400 }
      );
    }
    await deleteFoodEntry(foodId, scope);
    return NextResponse.json({ ok: true });
  }

  if (type === "time_block") {
    const blockId = typeof id === "string" ? id.trim() : "";
    if (!blockId) {
      return NextResponse.json(
        { error: "time_block delete requires id (uuid)" },
        { status: 400 }
      );
    }
    await deleteTimeBlock(blockId, scope);
    after(() => notifyHermesEventCancel(blockId));
    return NextResponse.json({ ok: true });
  }

  if (type === "spending") {
    const spendId = typeof id === "string" ? id.trim() : "";
    if (!spendId) {
      return NextResponse.json({ error: "spending delete requires id (uuid)" }, { status: 400 });
    }
    await deleteSpending(spendId, scope);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown type" }, { status: 400 });
}
